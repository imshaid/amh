-- Business settings, normalisation helpers, member profiles and who may read or change them.
begin;
\ir _setup.psql
select plan(46);

-- The settings row ---------------------------------------------------------------------------

select is((select count(*)::integer from public.business_settings), 1, 'there is exactly one settings row');
select is((select hotel_name_bn from public.business_settings), 'আদর্শ মুন্সির হোটেল', 'it carries the hotel''s name');
select is((select proprietor_bn from public.business_settings), 'মোঃ জিয়াউর রহমান (জিয়া)', 'and the proprietor''s');
select is(
  (select phones from public.business_settings),
  array['01715204224', '01937581298'],
  'the hotel''s phones are stored normalised'
);
select is((select number_prefix || ' ' || fiscal_year_start_month from public.business_settings), 'AMH 7', 'numbers start AMH and years start in July');
select throws_ok(
  $$ insert into public.business_settings (id, hotel_name_bn, hotel_name_en, proprietor_bn, proprietor_en, address_bn, address_en)
     values (false, 'x', 'x', 'x', 'x', 'x', 'x') $$,
  '23514', null,
  'a second settings row is refused'
);
select throws_ok(
  $$ update public.business_settings set phones = array['1715204224'] $$,
  '23514', null,
  'settings phones must be normalised'
);

-- Normalisation ------------------------------------------------------------------------------

select is(private.normalise_phone('01715204224'), '01715204224', 'a normal number stays as it is');
select is(private.normalise_phone('০১৭১৫-২০৪২২৪'), '01715204224', 'Bangla digits and dashes are read');
select is(private.normalise_phone('+880 1715 204224'), '01715204224', 'the +880 prefix is dropped');
select is(private.normalise_phone('8801715204224'), '01715204224', 'the 880 prefix is dropped');
select is(private.normalise_phone('1638387433.0'), '01638387433', 'a spreadsheet float that lost its zero is repaired');
select is(private.normalise_phone('1638387433'), '01638387433', 'a lost leading zero is restored');
select is(private.normalise_phone('01215204224'), null, 'an operator prefix that does not exist is refused');
select is(private.normalise_phone('0171520422'), null, 'a number that is too short is refused');
select is(private.normalise_phone(''), null, 'empty text is not a phone');

select is(private.name_key('Darapara L.R.'), private.name_key('darapara  lr'), 'names match regardless of case, dots and spacing');
select is(private.name_key('Lunch Basic-07'), 'lunch basic 07', 'other punctuation counts as a space');
select is(private.name_key('   '), null, 'a blank name has no key');
select is(private.reference_key('PBD-2794325'), 'PBD2794325', 'PO numbers compare without the hyphen');
select is(private.reference_key('pbd 2794325'), 'PBD2794325', 'or case and spaces');
select is(private.reference_key('--'), null, 'a reference without letters or digits has no key');

-- Members ------------------------------------------------------------------------------------

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_member('01711000002', 'বাবা') as bob \gset
select tests.create_member('01711000003', 'প্রাক্তন', false) as former \gset
select tests.create_user() as stranger \gset

select throws_ok(
  $$ insert into public.profiles (id, phone, display_name_bn) values (tests.create_user(), '1711000009', 'x') $$,
  '23514', null,
  'profile phones must be normalised'
);
select throws_ok(
  $$ insert into public.profiles (id, phone, display_name_bn) values (tests.create_user(), '01711000001', 'x') $$,
  '23505', null,
  'two members cannot share a phone'
);

select tests.act_as(:'alice');
select ok(private.is_member(), 'an active member is a member');
reset role;
select tests.act_as(:'former');
select ok(not private.is_member(), 'an inactive member is not');
reset role;
select tests.act_as(:'stranger');
select ok(not private.is_member(), 'nor is a signed-in user without a profile');
reset role;

-- Settings, as a member ----------------------------------------------------------------------

select tests.act_as(:'alice');
select is((select hotel_name_en from public.business_settings), 'Adarsha Munshir Hotel', 'members read the settings');
select lives_ok($$ update public.business_settings set tagline_en = 'Tested' $$, 'members edit the settings');
select throws_ok(
  $$ insert into public.business_settings (id, hotel_name_bn, hotel_name_en, proprietor_bn, proprietor_en, address_bn, address_en)
     values (true, 'x', 'x', 'x', 'x', 'x', 'x') $$,
  '42501', null,
  'members cannot add a settings row'
);
select throws_ok($$ delete from public.business_settings $$, '42501', null, 'members cannot remove it');
select throws_ok($$ update public.business_settings set id = true $$, '42501', null, 'or touch its key');

-- Profiles, as a member ----------------------------------------------------------------------

select is((select count(*)::integer from public.profiles), 3, 'members see every profile, active or not');
select results_eq(
  format($q$ with changed as (update public.profiles set language = 'en' where id = %L returning id) select count(*)::integer from changed $q$, :'alice'),
  $$ values (1) $$,
  'members change their own preferences'
);
select results_eq(
  format($q$ with changed as (update public.profiles set language = 'en' where id = %L returning id) select count(*)::integer from changed $q$, :'bob'),
  $$ values (0) $$,
  'but not someone else''s'
);
select throws_ok(
  format($q$ update public.profiles set active = false where id = %L $q$, :'alice'),
  '42501', null,
  'members cannot switch a profile on or off directly'
);
select throws_ok(
  format($q$ update public.profiles set phone = '01711000009' where id = %L $q$, :'alice'),
  '42501', null,
  'or change a sign-in phone directly'
);
select throws_ok(
  $$ insert into public.profiles (id, phone, display_name_bn) values (gen_random_uuid(), '01711000010', 'x') $$,
  '42501', null,
  'or add members directly'
);
select throws_ok(
  format($q$ delete from public.profiles where id = %L $q$, :'bob'),
  '42501', null,
  'or remove them'
);
reset role;

-- Everyone else ------------------------------------------------------------------------------

select tests.act_as(:'former');
select is((select count(*)::integer from public.profiles), 0, 'an inactive member sees no profiles');
select is((select count(*)::integer from public.business_settings), 0, 'and no settings');
reset role;

select tests.act_as(:'stranger');
select is((select count(*)::integer from public.profiles), 0, 'a non-member sees no profiles');
select results_eq(
  $$ with changed as (update public.business_settings set tagline_en = 'x' returning 1) select count(*)::integer from changed $$,
  $$ values (0) $$,
  'and changes no settings'
);
reset role;

select tests.act_as_anon();
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles at all');
select throws_ok('select * from public.business_settings', '42501', null, 'or settings');
reset role;

-- Bookkeeping --------------------------------------------------------------------------------

alter table public.business_settings disable trigger t05_touch_updated_at;
update public.business_settings set updated_at = '2020-01-01';
alter table public.business_settings enable trigger t05_touch_updated_at;
update public.business_settings set tagline_en = 'Again';
select is((select updated_at from public.business_settings), now(), 'a change stamps updated_at');

select * from finish();
rollback;
