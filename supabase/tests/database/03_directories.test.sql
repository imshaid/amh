-- Clients, places, contacts and packages: shapes, uniqueness, rate history and member-only access.
begin;
\ir _setup.psql
select plan(33);

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_user() as stranger \gset

select tests.act_as(:'alice');

-- Clients ------------------------------------------------------------------------------------

insert into public.organisations (name_en, name_bn) values ('World Vision Bangladesh', 'ওয়ার্ল্ড ভিশন বাংলাদেশ')
returning id as wv \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name, billing_address)
values (:'wv', 'REACTS-IN Project', 'REACTS-IN Project', 'Munshirhat, Gobindanagar, Thakurgaon')
returning id as reacts \gset

select is(
  (select deduction_rate from public.projects where id = :'reacts'),
  0.1600::numeric(5, 4),
  'a new client deducts 16% at source unless told otherwise'
);
select throws_ok(
  format($q$ insert into public.projects (organisation_id, name_en, billing_buyer_name) values (%L, 'reacts-in project', 'x') $q$, :'wv'),
  '23505', null,
  'an organisation cannot have two projects with the same name, whatever the case'
);
select throws_ok(
  format($q$ update public.projects set deduction_rate = 1 where id = %L $q$, :'reacts'),
  '23514', null,
  'a deduction of 100% or more is refused'
);
select throws_ok(
  format($q$ update public.projects set deduction_rate = -0.01 where id = %L $q$, :'reacts'),
  '23514', null,
  'and so is a negative one'
);
select throws_ok(
  format($q$ delete from public.organisations where id = %L $q$, :'wv'),
  '23503', null,
  'an organisation with projects cannot be deleted'
);

insert into public.log_codes (project_id, code, activity_en) values (:'reacts', '132.01.08', 'Impact+ session');
select throws_ok(
  format($q$ insert into public.log_codes (project_id, code) values (%L, '132.01.08') $q$, :'reacts'),
  '23505', null,
  'a log code appears once per project'
);
select throws_ok(
  format($q$ insert into public.log_codes (project_id, code) values (%L, '132 01') $q$, :'reacts'),
  '23514', null,
  'a log code has no spaces'
);

-- Places and people --------------------------------------------------------------------------

insert into public.areas (name_en, name_bn) values ('Nargun', 'নারগুন') returning id as nargun \gset
insert into public.locations (name_en, name_bn, area_id) values ('Darapara LR', 'দারাপাড়া এলআর', :'nargun')
returning id as darapara \gset
insert into public.locations (name_en) values ('Auliapur') returning id as auliapur \gset

insert into public.location_aliases (location_id, alias, source) values (:'darapara', 'Darapra', 'import');
select throws_ok(
  format($q$ insert into public.location_aliases (location_id, alias) values (%L, 'darapra.') $q$, :'auliapur'),
  '23505', null,
  'an alias points at one place only'
);
select lives_ok(
  $$ insert into public.locations (name_en) values ('Auliapur') $$,
  'two places may share a name (different unions)'
);

insert into public.contacts (name_en, phone) values ('Rina', '01711222333') returning id as rina \gset
select throws_ok(
  $$ insert into public.contacts (name_en, phone) values ('Rina', '1711222333') $$,
  '23514', null,
  'contact phones are stored normalised'
);
select throws_ok(
  $$ insert into public.contacts (phone) values ('01711222334') $$,
  '23514', null,
  'a contact needs a name in at least one language'
);
insert into public.contact_locations (contact_id, location_id) values (:'rina', :'darapara');
select throws_ok(
  format($q$ insert into public.contact_locations (contact_id, location_id) values (%L, %L) $q$, :'rina', :'darapara'),
  '23505', null,
  'a contact is linked to a place once (also when no project is given)'
);
select lives_ok(
  format($q$ insert into public.contact_locations (contact_id, location_id, project_id) values (%L, %L, %L) $q$, :'rina', :'darapara', :'reacts'),
  'and once more for a particular project'
);
select is(
  (select count(*)::integer from public.location_aliases where location_id = :'darapara'),
  1,
  'the place keeps its alias'
);
delete from public.contact_locations where location_id = :'darapara';
delete from public.locations where id = :'darapara';
select is(
  (select count(*)::integer from public.location_aliases where alias = 'Darapra'),
  0,
  'deleting a place deletes its aliases'
);

-- Packages -----------------------------------------------------------------------------------

insert into public.package_categories (name_en, name_bn, sort_order) values ('Lunch Basic', 'লাঞ্চ বেসিক', 2)
returning id as lunch \gset

insert into public.packages (name, category_id, rate, items)
values ('Lunch Basic-07', :'lunch', 355, '[{"en": "Chinigura Rice (Polao) — 300 g ±", "bn": "চিনিগুঁড়া চালের পোলাও"}, {"en": "Chicken Roast — 1 pc"}]')
returning id as basic07 \gset

select is(
  (select array_agg(rate order by created_at) from public.package_rates where package_id = :'basic07'),
  array[355.00]::numeric[],
  'a new package starts its rate history'
);
update public.packages set rate = 380 where id = :'basic07';
update public.packages set notes = 'Popular' where id = :'basic07';
select is(
  (select count(*)::integer from public.package_rates where package_id = :'basic07'),
  2,
  'a new rate adds to the history; other edits do not'
);
select is(
  (select created_by from public.package_rates where package_id = :'basic07' and rate = 380),
  :'alice'::uuid,
  'the history remembers who changed the rate'
);
select throws_ok(
  format($q$ insert into public.package_rates (package_id, rate) values (%L, 1) $q$, :'basic07'),
  '42501', null,
  'members cannot write rate history by hand'
);
select throws_ok(
  format($q$ insert into public.packages (name, category_id, rate) values ('lunch basic-07', %L, 1) $q$, :'lunch'),
  '23505', null,
  'package names (the WV codes) are unique, whatever the case'
);
select throws_ok(
  format($q$ insert into public.packages (name, category_id, rate) values ('Bad', %L, -1) $q$, :'lunch'),
  '23514', null,
  'a rate cannot be negative'
);
select lives_ok(
  format($q$ insert into public.packages (name, category_id, rate) values ('Lunch Basic-08', %L, 355) $q$, :'lunch'),
  'two packages may share a price'
);

-- Item lists must have the printed English text, and nothing unexpected.
select ok(private.is_item_list('[]'), 'an empty item list is fine');
select ok(private.is_item_list('[{"en": "Glass — 200 ml ±"}]'), 'Bangla text is optional');
select ok(not private.is_item_list('{"en": "x"}'), 'items are a list');
select ok(not private.is_item_list('[{"bn": "শুধু বাংলা"}]'), 'every item has printed English text');
select ok(not private.is_item_list('[{"en": "  "}]'), 'which is not blank');
select ok(not private.is_item_list('[{"en": "x", "bn": 3}]'), 'Bangla text is text');
select ok(not private.is_item_list('[{"en": "x", "qty": 3}]'), 'items carry no other keys');

insert into public.package_client_codes (package_id, organisation_id, code)
values (:'basic07', :'wv', 'ADORSHA_HOTEL_PACKAGE_07_LUNCH_BASIC');
select throws_ok(
  format($q$ insert into public.package_client_codes (package_id, organisation_id, code) values (%L, %L, 'ADORSHA_HOTEL_PACKAGE_07_LUNCH_BASIC') $q$, :'basic07', :'wv'),
  '23505', null,
  'a client code names one package per client'
);
reset role;

-- Everyone else ------------------------------------------------------------------------------

select tests.act_as(:'stranger');
select is(
  (select count(*)::integer from public.organisations) + (select count(*)::integer from public.packages)
    + (select count(*)::integer from public.locations) + (select count(*)::integer from public.contacts),
  0,
  'a non-member sees no clients, packages, places or contacts'
);
select throws_ok(
  $$ insert into public.areas (name_en) values ('Sneaky') $$,
  '42501', null,
  'and cannot add any'
);
reset role;

select tests.act_as_anon();
select throws_ok('select * from public.packages', '42501', null, 'anon cannot read packages at all');
reset role;

select * from finish();
rollback;
