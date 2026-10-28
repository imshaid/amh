-- Foundation: a private schema, default-deny privileges, shared helpers, the business settings row
-- and member profiles. The design is in docs/data-model.md.

-- ---------------------------------------------------------------------------------------------
-- Schemas and default privileges
-- ---------------------------------------------------------------------------------------------

-- Tables and functions the Data API must never serve. PostgREST exposes only `public`; members
-- still need USAGE here because RLS policies and triggers call functions in this schema.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Default deny. Supabase grants anon and authenticated everything on new objects in `public`, and
-- Postgres lets everyone execute new functions. Every table and function here states its own
-- grants instead, and database tests check that no table or function is left open.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

-- ---------------------------------------------------------------------------------------------
-- Shared types
-- ---------------------------------------------------------------------------------------------

create type public.ui_language as enum ('bn', 'en');
create type public.ui_theme as enum ('system', 'light', 'dark');

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The business runs on Bangladesh time: "today" is the calendar date in Asia/Dhaka.
create function private.dhaka_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Dhaka')::date
$$;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A Bangladeshi mobile number as 01XXXXXXXXX, or null if the text is not one. Accepts Bangla
-- digits, spaces, dashes, a +880/880 prefix, and spreadsheet damage: a lost leading zero and a
-- float suffix (1638387433.0 -> 01638387433).
create function private.normalise_phone(raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
begin
  if raw is null then
    return null;
  end if;
  digits := translate(btrim(raw), '০১২৩৪৫৬৭৮৯', '0123456789');
  digits := regexp_replace(digits, '\.0+$', '');
  digits := regexp_replace(digits, '[^0-9]', '', 'g');
  if digits ~ '^8801[3-9][0-9]{8}$' then
    digits := substr(digits, 3);
  elsif digits ~ '^1[3-9][0-9]{8}$' then
    digits := '0' || digits;
  end if;
  if digits ~ '^01[3-9][0-9]{8}$' then
    return digits;
  end if;
  return null;
end;
$$;

-- A comparison key for names typed by different people: case, dots, apostrophes and runs of
-- spaces or punctuation do not matter ("Darapara L.R." and "darapara  lr" match).
create function private.name_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(regexp_replace(regexp_replace(lower(raw), '[.''’]', '', 'g'), '[[:space:][:punct:]]+', ' ', 'g')),
    ''
  )
$$;

-- A reference such as a PO number, compared without punctuation or case: the bank SMS writes
-- PBD2778470 for the PO PBD-2778470.
create function private.reference_key(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(regexp_replace(raw, '[^0-9A-Za-z]', '', 'g')), '')
$$;

-- Generated columns, indexes and checks use these, so every role that writes rows may run them.
-- They are pure functions of their arguments.
grant execute on function private.dhaka_today() to authenticated, service_role;
grant execute on function private.normalise_phone(text) to authenticated, service_role;
grant execute on function private.name_key(text) to authenticated, service_role;
grant execute on function private.reference_key(text) to authenticated, service_role;

-- Keeps updated_at current on a table.
create function private.track_updates(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger t05_touch_updated_at before update on %s for each row execute function private.touch_updated_at()',
    p_table
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Business settings: one row that documents and numbering read (BLUEPRINT §4)
-- ---------------------------------------------------------------------------------------------

create function private.phones_are_normalised(phones text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(phone ~ '^01[3-9][0-9]{8}$'), true) from unnest(phones) as phone
$$;

grant execute on function private.phones_are_normalised(text[]) to authenticated, service_role;

create table public.business_settings (
  id boolean primary key default true constraint business_settings_single_row check (id),
  hotel_name_bn text not null constraint business_settings_hotel_name_bn_present check (btrim(hotel_name_bn) <> ''),
  hotel_name_en text not null constraint business_settings_hotel_name_en_present check (btrim(hotel_name_en) <> ''),
  proprietor_bn text not null,
  proprietor_en text not null,
  tagline_bn text not null default '',
  tagline_en text not null default '',
  address_bn text not null,
  address_en text not null,
  -- Normalised (01XXXXXXXXX); documents format them for print.
  phones text[] not null default '{}' constraint business_settings_phones_normalised check (private.phones_are_normalised(phones)),
  -- Paths in the private `branding` bucket; null means the built-in artwork.
  logo_path text,
  header_art_path text,
  -- Order AMH/26-27/0047, bill AMH/26-27/B-0047.
  number_prefix text not null default 'AMH' constraint business_settings_number_prefix_format check (number_prefix ~ '^[A-Z][A-Z0-9]{0,9}$'),
  -- Bangladesh's fiscal year runs July to June. A fiscal year always spans two calendar years.
  fiscal_year_start_month smallint not null default 7 constraint business_settings_fiscal_year_start_month_range check (fiscal_year_start_month between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_settings is
  'The single settings row: hotel names, proprietor, tagline, address and phones printed on every document, and number formats.';

select private.track_updates('public.business_settings');

insert into public.business_settings (
  hotel_name_bn, hotel_name_en,
  proprietor_bn, proprietor_en,
  tagline_bn, tagline_en,
  address_bn, address_en,
  phones
) values (
  'আদর্শ মুন্সির হোটেল', 'Adarsha Munshir Hotel',
  'মোঃ জিয়াউর রহমান (জিয়া)', 'Md. Ziaur Rahman (Zia)',
  'এখানে উন্নতমানের খাবার পরিবেশন করা হয় ও যেকোনো অনুষ্ঠানের অর্ডার নেওয়া হয়।', 'Quality food served here, and orders taken for any event.',
  'ঠাকুরগাঁও রোড, ঠাকুরগাঁও', 'Thakurgaon Road, Thakurgaon',
  array['01715204224', '01937581298']
);

-- ---------------------------------------------------------------------------------------------
-- Members: the three admins, all with the same rights (BLUEPRINT §1, §5.9)
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The sign-in name: members sign in with this phone number and a PIN.
  phone text not null
    constraint profiles_phone_key unique
    constraint profiles_phone_normalised check (phone ~ '^01[3-9][0-9]{8}$'),
  display_name_bn text not null constraint profiles_display_name_bn_present check (btrim(display_name_bn) <> ''),
  display_name_en text not null default '',
  language public.ui_language not null default 'bn',
  theme public.ui_theme not null default 'system',
  -- An inactive member keeps their history but can read and write nothing.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per member (admin). Rows are created by the member-auth Edge Function, never by sign-up.';

select private.track_updates('public.profiles');

-- Whether the caller is an active member. Every RLS policy rests on this. Security definer, so it
-- can read profiles without going through their own policy.
create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and active
  )
$$;

grant execute on function private.is_member() to authenticated, service_role;

-- The standard access rule (BLUEPRINT §5.9): only active members read or write, anon gets nothing.
-- Grants decide which commands exist at all; the policy decides who may use them. The service role
-- (Edge Functions, the PDF service) bypasses RLS.
create function private.grant_member_access(
  p_table regclass,
  p_privileges text default 'select, insert, update, delete'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('revoke all on table %s from anon, authenticated', p_table);
  execute format('grant all on table %s to service_role', p_table);
  if p_privileges <> '' then
    execute format('grant %s on table %s to authenticated', p_privileges, p_table);
  end if;
  execute format(
    'create policy members_only on %s for all to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
    p_table
  );
end;
$$;

-- Settings: members read and edit the single row; nobody adds or removes rows. Postgres has no
-- column-level revoke under a table-level grant, so editable columns are granted one by one.
select private.grant_member_access('public.business_settings', 'select');
grant update (
  hotel_name_bn, hotel_name_en, proprietor_bn, proprietor_en, tagline_bn, tagline_en,
  address_bn, address_en, phones, logo_path, header_art_path, number_prefix, fiscal_year_start_month
) on table public.business_settings to authenticated;

-- Profiles: members see each other; each member edits only their own names and preferences.
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant all on table public.profiles to service_role;
grant select on table public.profiles to authenticated;
grant update (display_name_bn, display_name_en, language, theme) on table public.profiles to authenticated;

create policy members_read on public.profiles
  for select to authenticated
  using ((select private.is_member()));

create policy members_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_member()))
  with check (id = (select auth.uid()));
