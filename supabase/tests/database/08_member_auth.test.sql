-- Member sign-in: PIN checks, lockouts that grow, no hints about who is a member, PIN changes,
-- adding and switching off members, and that only the server may call any of it.
begin;
\ir _setup.psql
select plan(36);

-- Stands in for the Edge Function's peppered digest: any 64-character hex string will do here.
create function tests.digest(p_pin text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to('test-pepper:' || p_pin, 'utf8')), 'hex')
$$;
grant execute on function tests.digest(text) to anon, authenticated, service_role;

-- The service role cannot read private tables (rightly); these let the tests look anyway.
create function tests.lock_left(p_phone text)
returns interval
language sql
security definer
as $$
  select locked_until - now() from private.sign_in_throttle where phone = p_phone
$$;
create function tests.failed_count(p_phone text)
returns integer
language sql
security definer
as $$
  select failed_count from private.sign_in_throttle where phone = p_phone
$$;
create function tests.pin_hash(p_user_id uuid)
returns text
language sql
security definer
as $$
  select pin_hash from private.member_pins where user_id = p_user_id
$$;
grant execute on function tests.lock_left(text), tests.failed_count(text), tests.pin_hash(uuid) to service_role;

-- Pretends the lock expired and the last mistake was a while ago.
create function tests.age_throttle(p_phone text, p_failed integer, p_last_failed interval default interval '1 minute')
returns void
language sql
as $$
  update private.sign_in_throttle
  set failed_count = p_failed, last_failed_at = now() - p_last_failed, locked_until = null
  where phone = p_phone
$$;

select tests.create_member('01711000001', 'মা') as mother \gset
select tests.create_member('01711000002', 'প্রাক্তন', false) as former \gset
select public.member_set_pin(:'mother', tests.digest('482913'));
select public.member_set_pin(:'former', tests.digest('111111'));

-- Signing in -----------------------------------------------------------------------------------

select tests.act_as_service();

select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('482913')) as r),
  'ok',
  'the right PIN signs the member in'
);
select is(
  (select (r ->> 'user_id')::uuid from public.member_check_pin('০১৭১১-০০০০০১', tests.digest('482913')) as r),
  :'mother'::uuid,
  'the phone can be typed in Bangla digits with a dash'
);
select ok(
  (select r ->> 'email' like '%@test.invalid' from public.member_check_pin('01711000001', tests.digest('482913')) as r),
  'and the Edge Function learns the member''s Auth email'
);

select is(
  (select r from public.member_check_pin('01711000001', tests.digest('000000')) as r),
  '{"status": "invalid", "remaining": 4}'::jsonb,
  'a wrong PIN says how many tries are left'
);
select member_check_pin('01711000001', tests.digest('000001'));
select member_check_pin('01711000001', tests.digest('000002'));
select is(
  (select r from public.member_check_pin('01711000001', tests.digest('000003')) as r),
  '{"status": "invalid", "remaining": 1}'::jsonb,
  'counting down with each mistake'
);
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('000004')) as r),
  'locked',
  'the fifth mistake locks the number'
);
select ok(
  tests.lock_left('01711000001') between interval '14 minutes' and interval '16 minutes',
  'for fifteen minutes'
);
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('482913')) as r),
  'locked',
  'while locked, even the right PIN waits'
);

reset role;
select tests.age_throttle('01711000001', 5);
select tests.act_as_service();
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('482913')) as r),
  'ok',
  'after the lock the right PIN works'
);
select is(
  tests.failed_count('01711000001'),
  0,
  'and the mistakes are forgiven'
);

reset role;
select tests.age_throttle('01711000001', 9);
select tests.act_as_service();
select member_check_pin('01711000001', tests.digest('000000'));
select ok(
  tests.lock_left('01711000001') between interval '29 minutes' and interval '31 minutes',
  'the next run of five mistakes locks for thirty minutes'
);

reset role;
select tests.age_throttle('01711000001', 199);
select tests.act_as_service();
select member_check_pin('01711000001', tests.digest('000000'));
select ok(
  tests.lock_left('01711000001') between interval '23 hours 59 minutes' and interval '24 hours 1 minute',
  'and the lock grows to a day at most'
);

reset role;
select tests.age_throttle('01711000001', 3, interval '25 hours');
select tests.act_as_service();
select is(
  (select r from public.member_check_pin('01711000001', tests.digest('000000')) as r),
  '{"status": "invalid", "remaining": 4}'::jsonb,
  'mistakes from more than a day ago are forgotten'
);

-- No hints about who is a member --------------------------------------------------------------

select is(
  (select r from public.member_check_pin('01799999999', tests.digest('482913')) as r),
  '{"status": "invalid", "remaining": 4}'::jsonb,
  'an unknown number gets the same answer as a wrong PIN'
);
select member_check_pin('01799999999', tests.digest('1'));
select member_check_pin('01799999999', tests.digest('2'));
select member_check_pin('01799999999', tests.digest('3'));
select is(
  (select r ->> 'status' from public.member_check_pin('01799999999', tests.digest('4')) as r),
  'locked',
  'and locks the same way'
);
select is(
  (select r from public.member_check_pin('12345', tests.digest('482913')) as r),
  '{"status": "invalid", "remaining": null}'::jsonb,
  'text that is not a phone number is simply wrong'
);
select is(
  (select r from public.member_check_pin('01711000001', 'not-a-digest') as r),
  '{"status": "invalid", "remaining": null}'::jsonb,
  'and so is a malformed digest'
);
select throws_ok(
  $$ select public.member_check_pin('01711000001', tests.digest('482913'), 'guess') $$,
  '22023', null,
  'an unknown purpose is refused'
);

-- Members switched off ------------------------------------------------------------------------

select is(
  (select r from public.member_check_pin('01711000002', tests.digest('111111')) as r),
  '{"status": "inactive"}'::jsonb,
  'a switched-off member learns so only with the right PIN'
);
select is(
  (select r ->> 'status' from public.member_check_pin('01711000002', tests.digest('222222')) as r),
  'invalid',
  'and a wrong PIN tells them nothing more'
);

-- Changing PINs -------------------------------------------------------------------------------

select member_check_pin('01711000001', tests.digest('000005'), 'verify');
select member_check_pin('01711000001', tests.digest('000006'), 'verify');
select member_check_pin('01711000001', tests.digest('000007'), 'verify');
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('000008'), 'verify') as r),
  'locked',
  'confirming a PIN before changing it counts mistakes the same way'
);
select public.member_set_pin(:'mother', tests.digest('739104'));
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('739104')) as r),
  'ok',
  'a new PIN works at once and clears the lock'
);
select is(
  (select r ->> 'status' from public.member_check_pin('01711000001', tests.digest('482913')) as r),
  'invalid',
  'and the old one no longer does'
);
select throws_ok(
  format($q$ select public.member_set_pin(%L, 'short') $q$, :'mother'),
  '22023', null,
  'a PIN is set only from a proper digest'
);
select ok(
  tests.pin_hash(:'mother') like '$2a$10$%',
  'PINs are kept as bcrypt hashes of the digest, never as the digest'
);

-- Adding and finding members ------------------------------------------------------------------

reset role;
select tests.create_user() as father_id \gset
select tests.act_as_service();
select is(
  (select r ->> 'phone' from public.member_create(:'father_id', '০১৯৩৭-৫৮১২৯৮', ' বাবা ', 'Baba', tests.digest('550011')) as r),
  '01937581298',
  'a new member''s phone is stored normalised'
);
select is(
  (select r ->> 'status' from public.member_check_pin('01937581298', tests.digest('550011')) as r),
  'ok',
  'and they can sign in straight away'
);
select is(
  (select r ->> 'display_name_bn' from public.member_lookup('+880 1937 581298') as r),
  'বাবা',
  'members are found by phone, however it is written'
);
select is(public.member_lookup('01700000000'), null, 'an unknown number finds nobody');
reset role;
select throws_ok(
  format($q$ select public.member_create(%L, '01937581298', 'x', '', %L) $q$, tests.create_user(), tests.digest('1')),
  '23505', null,
  'a phone number belongs to one member'
);
select throws_ok(
  format($q$ select public.member_create(%L, '12345', 'x', '', %L) $q$, tests.create_user(), tests.digest('1')),
  '22023', 'invalid_phone',
  'and must be a mobile number'
);
select tests.act_as_service();
select is(
  (select (r ->> 'active')::boolean from public.member_set_active(:'father_id', false) as r),
  false,
  'a member can be switched off'
);
reset role;

select results_eq(
  -- Only this test's attempts: they carry its transaction's timestamp.
  $$ select outcome, count(*)::integer from private.sign_in_attempts where at = now() group by outcome order by outcome $$,
  $$ values ('inactive', 1), ('locked', 1), ('ok', 6), ('unknown_phone', 5), ('wrong_pin', 14) $$,
  'every attempt is logged with its outcome'
);

-- Only the server -----------------------------------------------------------------------------

select tests.act_as(:'mother');
select throws_ok(
  $$ select public.member_check_pin('01711000001', 'x') $$,
  '42501', null,
  'members cannot check PINs themselves'
);
select throws_ok(
  format($q$ select public.member_set_pin(%L, %L) $q$, :'mother', tests.digest('1')),
  '42501', null,
  'or set them directly'
);
reset role;
select tests.act_as_anon();
select throws_ok(
  $$ select public.member_check_pin('01711000001', 'x') $$,
  '42501', null,
  'and neither can anyone signed out: only the member-auth function can'
);
reset role;

select * from finish();
rollback;
