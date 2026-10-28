-- Directory screens: client and location figures, and the package list import (check, then apply).
-- Names start with "pgTAP" so they never meet rows that other test runs left in the database.
begin;
\ir _setup.psql
select plan(39);

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_user() as stranger \gset

insert into public.organisations (name_en) values ('pgTAP World Vision') returning id as wv \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name)
values (:'wv', 'pgTAP Thakurgaon AP', 'Thakurgaon AP') returning id as ap \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name, deduction_rate)
values (:'wv', 'pgTAP Walk-in', 'Walk-in', 0) returning id as walkin \gset
insert into public.package_categories (name_en) values ('pgTAP Sample') returning id as cat \gset

-- Issues a bill as the issue function will (Segment 5), on a chosen day, with the server's rights.
create function tests.issue(p_bill_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_totals public.order_totals;
begin
  select * into v from private.bill_number_for(p_bill_id, p_day);
  select t.* into v_totals from public.order_totals as t join public.bills as b on b.order_id = t.order_id where b.id = p_bill_id;
  update public.bills
  set state = 'issued', fiscal_year = v.fiscal_year, seq = v.seq, number = v.number,
    gross = v_totals.gross, deduction_rate = v_totals.deduction_rate, deduction = v_totals.deduction,
    expected_net = v_totals.expected_net, amount_in_words = 'Test',
    issued_at = (p_day + time '12:00') at time zone 'Asia/Dhaka'
  where id = p_bill_id;
  perform set_config('amh.system_change', 'on', true);
  update public.orders set status = 'billed' where id = (select order_id from public.bills where id = p_bill_id);
  perform set_config('amh.system_change', '', true);
end;
$$;

-- An order of one line, quantity typed on the bill.
create function tests.order_of(p_project uuid, p_rate numeric, p_qty integer)
returns uuid
language plpgsql
as $$
declare
  v_order uuid;
begin
  insert into public.orders (project_id, title) values (p_project, 'pgTAP order') returning id into v_order;
  insert into public.order_lines (order_id, name, items, rate, bill_qty)
  values (v_order, 'pgTAP Lunch', '[{"en": "Rice"}]', p_rate, p_qty);
  return v_order;
end;
$$;

create function tests.bill_of(p_order uuid)
returns uuid
language sql
as $$
  select id from public.bills where order_id = p_order and revision = 0
$$;

grant execute on all functions in schema tests to authenticated;

select tests.act_as(:'alice');

-- Client figures ------------------------------------------------------------------------------

select is(
  (select billed_this_fy || ' / ' || unpaid || ' / ' || unpaid_bills || ' / ' || coalesce(avg_days_to_pay::text, 'none')
   from public.project_figures where project_id = :'ap'),
  '0.00 / 0.00 / 0 / none',
  'a client without bills has billed nothing, owes nothing and has no payment speed yet'
);
select is(
  (select net_per_100 from public.project_figures where project_id = :'ap'),
  84.00,
  'at the default 16% a ৳100 bill brings ৳84 to the bank'
);
select is(
  (select net_per_100 from public.project_figures where project_id = :'walkin'),
  100.00,
  'a client that deducts nothing pays the full ৳100'
);

-- This year: ৳10,000 and ৳5,000. Last fiscal year: ৳2,000, still unpaid.
select tests.order_of(:'ap', 500, 20) as o_big \gset
select tests.order_of(:'ap', 250, 20) as o_small \gset
select tests.order_of(:'ap', 100, 20) as o_old \gset
select tests.issue(tests.bill_of(:'o_big'), private.dhaka_today());
select tests.issue(tests.bill_of(:'o_small'), private.dhaka_today());
select tests.issue(tests.bill_of(:'o_old'), (private.dhaka_today() - interval '1 year')::date);

select is(
  (select billed_this_fy || ' / ' || bills_this_fy from public.project_figures where project_id = :'ap'),
  '15000.00 / 2',
  'billed this fiscal year counts only bills issued in it'
);
select is(
  (select unpaid || ' / ' || unpaid_expected_net || ' / ' || unpaid_bills from public.project_figures where project_id = :'ap'),
  '17000.00 / 14280.00 / 3',
  'unpaid counts every open bill, at gross and at what should reach the bank'
);
select ok(
  (select oldest_unpaid_days >= 365 from public.project_figures where project_id = :'ap'),
  'the oldest unpaid bill is last year''s'
);

-- The big bill is paid 30 days after it was issued, net of the 16% deduction.
insert into public.payments (received_on, amount) values (private.dhaka_today() + 30, 8400) returning id as pay \gset
insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount)
values (:'pay', tests.bill_of(:'o_big'), 8400, 1600);

select is(
  (select unpaid || ' / ' || unpaid_bills || ' / ' || avg_days_to_pay || ' / ' || paid_orders
   from public.project_figures where project_id = :'ap'),
  '7000.00 / 2 / 30 / 1',
  'a settled bill leaves the unpaid figures and sets the days to pay'
);

-- A part payment does not count as paid.
insert into public.payments (received_on, amount) values (private.dhaka_today(), 1000) returning id as part \gset
insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount)
values (:'part', tests.bill_of(:'o_small'), 1000, 0);
select is(
  (select unpaid || ' / ' || avg_days_to_pay || ' / ' || paid_orders from public.project_figures where project_id = :'ap'),
  '6000.00 / 30 / 1',
  'a part payment lowers the unpaid amount but is not counted as paid'
);

reset role;
select tests.act_as(:'stranger');
select is((select count(*) from public.project_figures where project_id = :'ap'), 0::bigint, 'non-members see no client figures');
reset role;
select tests.act_as(:'alice');

-- Location figures ----------------------------------------------------------------------------

insert into public.locations (name_en) values ('pgTAP Darapara') returning id as place \gset
insert into public.locations (name_en) values ('pgTAP Quiet Place') returning id as quiet \gset
insert into public.orders (project_id, title) values (:'ap', 'pgTAP deliveries') returning id as o_live \gset
insert into public.orders (project_id, title) values (:'ap', 'pgTAP cancelled') returning id as o_gone \gset
insert into public.challans (order_id, delivery_date, location_id) values
  (:'o_live', private.dhaka_today(), :'place'),
  (:'o_live', private.dhaka_today(), :'place'),
  (:'o_live', (private.dhaka_today() - interval '1 year')::date, :'place'),
  (:'o_gone', private.dhaka_today(), :'place');
update public.orders set status = 'cancelled' where id = :'o_gone';

select is(
  (select deliveries_this_fy || ' / ' || deliveries_total || ' / ' || last_delivery_on
   from public.location_figures where location_id = :'place'),
  '2 / 3 / ' || private.dhaka_today()::text,
  'deliveries count this year and all time, without cancelled orders'
);
select is(
  (select deliveries_this_fy || ' / ' || deliveries_total || ' / ' || coalesce(last_delivery_on::text, 'never')
   from public.location_figures where location_id = :'quiet'),
  '0 / 0 / never',
  'a place nobody delivered to yet'
);

-- Package list import: checking ---------------------------------------------------------------

select '{
  "categories": [
    {"name_en": "pgTAP Snacks", "name_bn": "নাস্তা"},
    {"name_en": "pgTAP Lunch", "name_bn": "লাঞ্চ"}
  ],
  "packages": [
    {"name": "pgTAP Single Item-17", "category": "pgTAP Snacks", "rate": "60",
     "items": [{"en": "Red Apple — 1 pc, 100 g ±", "bn": "লাল আপেল"}, {"en": "Cookies — 2 pcs"}], "notes": ""},
    {"name": "pgTAP Single Item-19", "category": "pgTAP Snacks", "rate": "60",
     "items": [{"en": "Orange — 1 pc, 100 g ±"}]},
    {"name": "pgTAP Lunch Basic-07", "category": "pgTAP Lunch", "rate": "355.50",
     "items": [{"en": "Plain Rice — 300 g ±"}], "notes": "WV PO name"}
  ]
}'::jsonb as list \gset

select public.import_package_list(:'list') as checked \gset

select is((:'checked'::jsonb ->> 'applied')::boolean, false, 'a check says it applied nothing');
select is(
  (select count(*) from public.packages where name like 'pgTAP %'),
  0::bigint,
  'and nothing was written'
);
select is(
  (select array_agg(p ->> 'outcome' order by p ->> 'name') from jsonb_array_elements(:'checked'::jsonb -> 'packages') as p),
  array['new', 'new', 'new'],
  'every package in a first list is new'
);
select is(
  (select array_agg(c ->> 'outcome') from jsonb_array_elements(:'checked'::jsonb -> 'categories') as c),
  array['new', 'new'],
  'and so is every category'
);
select is(
  (select p ->> 'rate' from jsonb_array_elements(:'checked'::jsonb -> 'packages') as p where p ->> 'name' = 'pgTAP Lunch Basic-07'),
  '355.50',
  'rates come back as exact decimal strings'
);

-- Package list import: applying ---------------------------------------------------------------

select public.import_package_list(:'list', true) as applied \gset

select is((:'applied'::jsonb ->> 'applied')::boolean, true, 'applying says so');
select is(
  (select string_agg(name || ' ' || rate || ' ' || jsonb_array_length(items), ', ' order by name) from public.packages where name like 'pgTAP %'),
  'pgTAP Lunch Basic-07 355.50 1, pgTAP Single Item-17 60.00 2, pgTAP Single Item-19 60.00 1',
  'the packages are created with their rates and items'
);
select is(
  (select string_agg(name_en || ' ' || name_bn || ' ' || sort_order, ', ' order by sort_order) from public.package_categories where name_en like 'pgTAP %' and id <> :'cat'),
  'pgTAP Snacks নাস্তা 1, pgTAP Lunch লাঞ্চ 2',
  'categories keep the list''s order and Bangla names'
);
select is(
  (select notes from public.packages where name = 'pgTAP Lunch Basic-07'),
  'WV PO name',
  'notes are imported'
);
select is(
  (select count(*) from public.package_rates r join public.packages p on p.id = r.package_id where p.name like 'pgTAP %'),
  3::bigint,
  'each new package starts its rate history'
);
select is(
  (select count(distinct batch_id) || ' / ' || count(*) filter (where batch_id is null)
   from public.audit_log
   where entity_type in ('packages', 'package_categories')
     and (after ->> 'name' like 'pgTAP %' or after ->> 'name_en' in ('pgTAP Snacks', 'pgTAP Lunch'))),
  '1 / 0',
  'every change of the import shares one audit batch'
);
select is(
  (select distinct batch_id::text from public.audit_log where entity_type = 'packages' and after ->> 'name' = 'pgTAP Single Item-17'),
  :'applied'::jsonb ->> 'batch_id',
  'the batch is the one the import reported'
);

select is(
  (select array_agg(p ->> 'outcome') from jsonb_array_elements(public.import_package_list(:'list') -> 'packages') as p),
  array['unchanged', 'unchanged', 'unchanged'],
  'checking the same list again finds nothing to change'
);

-- A second list: a new rate and items for one package, a name typed differently for another, no
-- items or notes for the third, and a switched-off package back in the list.
update public.packages set active = false where name = 'pgTAP Single Item-19';
insert into public.packages (name, category_id, rate) values ('pgTAP Old Package', :'cat', 45);

select '{
  "categories": [{"name_en": "pgTAP Snacks"}, {"name_en": "pgTAP Lunch"}],
  "packages": [
    {"name": "pgTAP Single Item-17", "category": "pgTAP Snacks", "rate": "65",
     "items": [{"en": "Red Apple — 1 pc, 120 g ±"}, {"en": "Cookies — 2 pcs"}], "notes": ""},
    {"name": "pgtap single item-19", "category": "pgTAP Snacks", "rate": "60", "items": [{"en": "Orange — 1 pc, 100 g ±"}]},
    {"name": "pgTAP Lunch Basic-07", "category": "pgTAP Lunch", "rate": "355.5"}
  ]
}'::jsonb as list2 \gset

select public.import_package_list(:'list2') as checked2 \gset

select is(
  (select jsonb_agg(jsonb_build_object('name', p ->> 'name', 'outcome', p -> 'outcome', 'changes', p -> 'changes') order by p ->> 'name')
   from jsonb_array_elements(:'checked2'::jsonb -> 'packages') as p),
  '[
    {"name": "pgTAP Lunch Basic-07", "outcome": "unchanged", "changes": []},
    {"name": "pgTAP Single Item-17", "outcome": "changed", "changes": ["rate", "items"]},
    {"name": "pgtap single item-19", "outcome": "changed", "changes": ["name", "active"]}
  ]'::jsonb,
  'a check names what would change for each package'
);
select is(
  (select (p ->> 'old_rate') || ' -> ' || (p ->> 'rate') from jsonb_array_elements(:'checked2'::jsonb -> 'packages') as p where p ->> 'name' = 'pgTAP Single Item-17'),
  '60.00 -> 65.00',
  'a rate change shows the old and the new rate'
);
select is(
  (select array_agg(c ->> 'outcome') from jsonb_array_elements(:'checked2'::jsonb -> 'categories') as c),
  array['unchanged', 'unchanged'],
  'a category without a Bangla name in the list keeps its own'
);
select ok(
  (select bool_or(n ->> 'name' = 'pgTAP Old Package') from jsonb_array_elements(:'checked2'::jsonb -> 'not_in_list') as n),
  'a package missing from the list is reported'
);

select public.import_package_list(:'list2', true) as applied2 \gset

select is(
  (select rate::text || ' ' || (items -> 0 ->> 'en') from public.packages where name = 'pgTAP Single Item-17'),
  '65.00 Red Apple — 1 pc, 120 g ±',
  'applying changes the rate and the items'
);
select is(
  (select array_agg(r.rate order by r.created_at, r.rate) from public.package_rates r join public.packages p on p.id = r.package_id where p.name = 'pgTAP Single Item-17'),
  array[60.00, 65.00]::numeric[],
  'and the rate history keeps both rates'
);
select is(
  (select name || ' ' || active from public.packages where private.name_key(name) = private.name_key('pgTAP Single Item-19')),
  'pgtap single item-19 true',
  'a package in the list is switched back on, under the name the list gives'
);
select is(
  (select jsonb_array_length(items) || ' ' || notes from public.packages where name = 'pgTAP Lunch Basic-07'),
  '1 WV PO name',
  'a list without items or notes leaves them as they are'
);
select is(
  (select active from public.packages where name = 'pgTAP Old Package'),
  true,
  'a package missing from the list is left alone'
);

-- Package list import: refusals -----------------------------------------------------------------

select throws_ok(
  $$ select public.import_package_list('{"categories": [{"name_en": "pgTAP Snacks"}], "packages": [
       {"name": "pgTAP Twice", "category": "pgTAP Snacks", "rate": "10"},
       {"name": "pgtap  twice", "category": "pgTAP Snacks", "rate": "10"}]}', true) $$,
  'AMH05', 'package_list_invalid',
  'a list naming one package twice is refused'
);
select throws_ok(
  $$ select public.import_package_list('{"categories": [{"name_en": "pgTAP Snacks"}], "packages": [
       {"name": "pgTAP Bad Rate", "category": "pgTAP Snacks", "rate": "fifty"}]}') $$,
  'AMH05', 'package_list_invalid',
  'a rate that is not a number is refused'
);
select throws_ok(
  $$ select public.import_package_list('{"categories": [{"name_en": "pgTAP Snacks"}], "packages": [
       {"name": "pgTAP Lost", "category": "pgTAP Nowhere", "rate": "10"}]}') $$,
  'AMH05', 'package_list_invalid',
  'a package in a category the list does not have is refused'
);
select throws_ok(
  $$ select public.import_package_list('{"categories": [{"name_en": "pgTAP Snacks"}], "packages": [
       {"name": "pgTAP Bad Items", "category": "pgTAP Snacks", "rate": "10", "items": ["Rice"]}]}') $$,
  'AMH05', 'package_list_invalid',
  'items that are not lines are refused'
);

reset role;
select tests.act_as(:'stranger');
select throws_ok(
  format($q$ select public.import_package_list(%L, true) $q$, :'list'),
  '42501', null,
  'a non-member cannot import'
);
reset role;
select tests.act_as_anon();
select throws_ok(
  format($q$ select public.import_package_list(%L) $q$, :'list'),
  '42501', null,
  'anon cannot even check a list'
);

select * from finish();
rollback;
