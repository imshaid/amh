-- Member sign-in (BLUEPRINT §5.9): a phone number and a 6-digit PIN, for members who are not
-- technical. Only the member-auth Edge Function calls these functions (service role):
--
--   1. It turns the PIN into a digest with a secret pepper only it holds (HMAC-SHA256), and the
--      database keeps bcrypt(digest). A copy of the database alone reveals no PIN.
--   2. member_check_pin counts mistakes per phone number: five in a row lock the number for 15
--      minutes, the next five for 30, doubling up to a day. Unknown numbers are counted the same
--      way, so answers never reveal who is a member. A run of mistakes is forgotten after a day.
--   3. On success the function signs the member in to Supabase Auth with a password derived from
--      the same pepper. Nobody types it, and it cannot be guessed through the Auth API.

create table private.member_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  set_at timestamptz not null default now()
);

create table private.sign_in_throttle (
  phone text primary key,
  failed_count integer not null default 0 constraint sign_in_throttle_failed_count_not_negative check (failed_count >= 0),
  last_failed_at timestamptz,
  locked_until timestamptz
);

-- Every attempt, for the audit viewer and for spotting someone guessing.
create table private.sign_in_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  phone text not null,
  user_id uuid,
  purpose text not null constraint sign_in_attempts_purpose_known check (purpose in ('sign_in', 'verify')),
  outcome text not null constraint sign_in_attempts_outcome_known check (outcome in ('ok', 'wrong_pin', 'unknown_phone', 'locked', 'inactive')),
  client_ip text
);

create index sign_in_attempts_at_idx on private.sign_in_attempts (at desc);
create index sign_in_attempts_phone_idx on private.sign_in_attempts (phone, at desc);

-- Checks a PIN digest for a phone number. Returns one of
--   {"status": "ok", "user_id": ..., "email": ...}      the member, and their Auth email
--   {"status": "invalid", "remaining": n}               wrong PIN or unknown number; n tries left
--   {"status": "locked", "retry_at": ...}               too many mistakes; try again after retry_at
--   {"status": "inactive"}                              right PIN, but the member was switched off
-- p_purpose is 'sign_in', or 'verify' when a signed-in member confirms their PIN (to change it).
create function public.member_check_pin(
  p_phone text,
  p_pin_digest text,
  p_purpose text default 'sign_in',
  p_client_ip text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_tries constant integer := 5;
  c_first_lock constant interval := interval '15 minutes';
  c_longest_lock constant interval := interval '24 hours';
  c_forget_after constant interval := interval '24 hours';
  v_phone text := private.normalise_phone(p_phone);
  v_throttle private.sign_in_throttle;
  v_profile public.profiles;
  v_hash text;
  v_matches boolean;
  v_lock interval;
begin
  if p_purpose not in ('sign_in', 'verify') then
    raise exception 'unknown purpose %', p_purpose using errcode = '22023';
  end if;
  if v_phone is null or p_pin_digest is null or p_pin_digest !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid', 'remaining', null);
  end if;

  -- One attempt per number at a time: the row lock queues concurrent guesses.
  insert into private.sign_in_throttle (phone) values (v_phone) on conflict (phone) do nothing;
  select * into v_throttle from private.sign_in_throttle where phone = v_phone for update;

  if v_throttle.locked_until > now() then
    insert into private.sign_in_attempts (phone, purpose, outcome, client_ip)
    values (v_phone, p_purpose, 'locked', p_client_ip);
    return jsonb_build_object('status', 'locked', 'retry_at', v_throttle.locked_until);
  end if;
  if v_throttle.last_failed_at < now() - c_forget_after then
    v_throttle.failed_count := 0;
  end if;

  select * into v_profile from public.profiles where phone = v_phone;
  select pin_hash into v_hash from private.member_pins where user_id = v_profile.id;
  -- An unknown number costs the same bcrypt work as a known one.
  v_matches := extensions.crypt(p_pin_digest, coalesce(v_hash, extensions.gen_salt('bf', 10))) = v_hash;

  if v_matches then
    update private.sign_in_throttle
    set failed_count = 0, last_failed_at = null, locked_until = null
    where phone = v_phone;
    insert into private.sign_in_attempts (phone, user_id, purpose, outcome, client_ip)
    values (v_phone, v_profile.id, p_purpose, case when v_profile.active then 'ok' else 'inactive' end, p_client_ip);
    if not v_profile.active then
      return jsonb_build_object('status', 'inactive');
    end if;
    return jsonb_build_object(
      'status', 'ok',
      'user_id', v_profile.id,
      'email', (select email from auth.users where id = v_profile.id)
    );
  end if;

  v_throttle.failed_count := v_throttle.failed_count + 1;
  v_throttle.locked_until := null;
  if v_throttle.failed_count % c_tries = 0 then
    -- The exponent is capped first: after many runs 15 minutes × 2^n would overflow an interval.
    v_lock := least(c_first_lock * power(2, least(v_throttle.failed_count / c_tries - 1, 8)), c_longest_lock);
    v_throttle.locked_until := now() + v_lock;
  end if;
  update private.sign_in_throttle
  set failed_count = v_throttle.failed_count, last_failed_at = now(), locked_until = v_throttle.locked_until
  where phone = v_phone;
  insert into private.sign_in_attempts (phone, user_id, purpose, outcome, client_ip)
  values (v_phone, v_profile.id, p_purpose, case when v_hash is null then 'unknown_phone' else 'wrong_pin' end, p_client_ip);

  if v_throttle.locked_until is not null then
    return jsonb_build_object('status', 'locked', 'retry_at', v_throttle.locked_until);
  end if;
  return jsonb_build_object('status', 'invalid', 'remaining', c_tries - v_throttle.failed_count % c_tries);
end;
$$;

-- Sets a member's PIN (a new member's, a reset by another member, or their own change) and clears
-- any lock on their number.
create function public.member_set_pin(p_user_id uuid, p_pin_digest text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_pin_digest is null or p_pin_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_pin_digest' using errcode = '22023';
  end if;
  insert into private.member_pins (user_id, pin_hash)
  values (p_user_id, extensions.crypt(p_pin_digest, extensions.gen_salt('bf', 10)))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, set_at = now();
  update private.sign_in_throttle
  set failed_count = 0, last_failed_at = null, locked_until = null
  where phone = (select phone from public.profiles where id = p_user_id);
end;
$$;

-- Adds a member for an Auth user the Edge Function has just created.
create function public.member_create(
  p_user_id uuid,
  p_phone text,
  p_name_bn text,
  p_name_en text,
  p_pin_digest text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalise_phone(p_phone);
  v_profile public.profiles;
begin
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023', detail = 'Expected a mobile number like 01712345678.';
  end if;
  insert into public.profiles (id, phone, display_name_bn, display_name_en)
  values (p_user_id, v_phone, btrim(p_name_bn), coalesce(btrim(p_name_en), ''))
  returning * into v_profile;
  perform public.member_set_pin(p_user_id, p_pin_digest);
  return to_jsonb(v_profile);
end;
$$;

-- The member with this phone number, or null.
create function public.member_lookup(p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) from public.profiles as p where p.phone = private.normalise_phone(p_phone)
$$;

-- Switches a member on or off. An inactive member keeps their history and can do nothing.
create function public.member_set_active(p_user_id uuid, p_active boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles set active = p_active where id = p_user_id returning * into v_profile;
  return to_jsonb(v_profile);
end;
$$;

revoke all on function public.member_check_pin(text, text, text, text) from public, anon, authenticated;
revoke all on function public.member_set_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.member_create(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.member_lookup(text) from public, anon, authenticated;
revoke all on function public.member_set_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.member_check_pin(text, text, text, text) to service_role;
grant execute on function public.member_set_pin(uuid, text) to service_role;
grant execute on function public.member_create(uuid, text, text, text, text) to service_role;
grant execute on function public.member_lookup(text) to service_role;
grant execute on function public.member_set_active(uuid, boolean) to service_role;
