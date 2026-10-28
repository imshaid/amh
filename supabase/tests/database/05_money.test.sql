-- Money: line amounts, order totals, deduction and expected net, payments, allocations, balances
-- and the paid status. The order is the REACTS-IN sample bill (docs/reference/samples): six
-- packages, ৳69,270.
begin;
\ir _setup.psql
select plan(40);

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_user() as stranger \gset

insert into public.organisations (name_en) values ('World Vision Bangladesh') returning id as wv \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name)
values (:'wv', 'REACTS-IN Project', 'REACTS-IN Project') returning id as reacts \gset
insert into public.package_categories (name_en) values ('Sample') returning id as cat \gset

create function tests.issue(p_bill_id uuid)
returns void
language plpgsql
as $$
declare
  v record;
  v_totals public.order_totals;
begin
  select * into v from private.bill_number_for(p_bill_id, private.dhaka_today());
  select t.* into v_totals from public.order_totals as t join public.bills as b on b.order_id = t.order_id where b.id = p_bill_id;
  update public.bills
  set state = 'issued', fiscal_year = v.fiscal_year, seq = v.seq, number = v.number,
    gross = v_totals.gross, deduction_rate = v_totals.deduction_rate, deduction = v_totals.deduction,
    expected_net = v_totals.expected_net, amount_in_words = 'Test', issued_at = now()
  where id = p_bill_id;
  perform set_config('amh.system_change', 'on', true);
  update public.orders set status = 'billed' where id = (select order_id from public.bills where id = p_bill_id);
  perform set_config('amh.system_change', '', true);
end;
$$;

-- The formulas ------------------------------------------------------------------------------

select is(private.deduction_of(69270.00, 0.16), 11083.20, '16% of ৳69,270 is ৳11,083.20');
select is(private.expected_net_of(69270.00, 0.16), 58186.80, 'so ৳58,186.80 should reach the bank');
select is(private.deduction_of(100, 0.16) + private.expected_net_of(100, 0.16), 100.00::numeric, 'deduction and net add up to the gross');
select is(private.deduction_of(0.05, 0.1), 0.01, 'half a paisa rounds away from zero');
select is(private.expected_net_of(0.05, 0.1), 0.04, 'and the net takes the rest');
select is(private.deduction_of(1234.56, 0), 0.00, 'a client that deducts nothing');

-- Lines and order totals --------------------------------------------------------------------

select tests.act_as(:'alice');
insert into public.orders (project_id, title, po_number, entry_mode)
values (:'reacts', 'August 18', 'PBD-2778470', 'page_editor') returning id as o1 \gset

-- The sample bill, typed page by page: bill quantities are entered directly.
insert into public.order_lines (order_id, name, items, rate, bill_qty) values
  (:'o1', 'Sweet (Curd/Firnee)', '[{"en": "Sweet Curd / Firnee (Cup type) - 65 grams (±)"}]', 40, 96),
  (:'o1', 'Snacks Standard 2', '[{"en": "Potato / Vegetable Singara / Chomocha 1 pc - 100 grams (±)"}]', 45, 96),
  (:'o1', 'Snacks Basic 2', '[{"en": "Olympic Biscuit - 62 grams (±)"}]', 50, 192),
  (:'o1', 'Lunch Standard 3', '[{"en": "Chinigura Rice / Polao 2 plates - 300 grams (±)"}]', 520, 96),
  (:'o1', 'Mineral Water (5L)', '[{"en": "Mineral Water - 5 liter (±)"}]', 105, 6),
  (:'o1', 'Glass', '[{"en": "Disposable Paper Glass - 200 ml (±)"}]', 5, 192);

select results_eq(
  format($q$ select amount from public.order_line_totals where order_id = %L order by position $q$, :'o1'),
  $$ values (3840.00), (4320.00), (9600.00), (49920.00), (630.00), (960.00) $$,
  'each line is its bill quantity times its rate'
);
select is(
  (select gross || ' / ' || deduction_rate || ' / ' || deduction || ' / ' || expected_net from public.order_totals where order_id = :'o1'),
  '69270.00 / 0.1600 / 11083.20 / 58186.80',
  'the order''s gross, the client''s deduction rate, the deduction and the expected net'
);

-- Quantities from challans, and a typed quantity that disagrees with them.
insert into public.orders (project_id, title) values (:'reacts', 'Schedule order') returning id as o2 \gset
insert into public.order_lines (order_id, name, items, rate) values (:'o2', 'Lunch Basic-07', '[{"en": "Rice"}]', 355)
returning id as l_lunch \gset
insert into public.order_lines (order_id, name, items, rate) values (:'o2', 'Snacks Single Item-17', '[{"en": "Cake"}]', 60)
returning id as l_snack \gset
insert into public.challans (order_id, delivery_date) values (:'o2', '2026-09-08') returning id as c1 \gset
insert into public.challans (order_id, delivery_date) values (:'o2', '2026-09-12') returning id as c2 \gset
insert into public.challan_lines (challan_id, order_line_id, qty) values
  (:'c1', :'l_lunch', 5), (:'c2', :'l_lunch', 4), (:'c1', :'l_snack', null);

select is(
  (select challan_qty || ' / ' || bill_qty || ' / ' || amount from public.order_line_totals where order_line_id = :'l_lunch'),
  '9 / 9 / 3195.00',
  'without a typed quantity the bill takes the challans'' sum'
);
select is(
  (select bill_qty || ' / ' || amount from public.order_line_totals where order_line_id = :'l_snack'),
  '0 / 0.00',
  'a line with no quantities yet bills nothing'
);
update public.order_lines set bill_qty = 10 where id = :'l_lunch';
select is(
  (select challan_qty || ' / ' || bill_qty || ' / ' || qty_differs from public.order_line_totals where order_line_id = :'l_lunch'),
  '9 / 10 / true',
  'a typed quantity wins, and the difference from the challans is flagged'
);
select is(
  (select gross || ' / ' || qty_differs_count from public.order_totals where order_id = :'o2'),
  '3550.00 / 1',
  'the order counts lines whose quantities disagree'
);
update public.projects set deduction_rate = 0.10 where id = :'reacts';
select is(
  (select deduction_rate || ' / ' || deduction from public.order_totals where order_id = :'o2'),
  '0.1000 / 355.00',
  'an unbilled order follows the client''s current rate'
);
update public.projects set deduction_rate = 0.16 where id = :'reacts';
reset role;

-- Issue the sample bill and record its payment ----------------------------------------------

select id as b1 from public.bills where order_id = :'o1' \gset
select id as b2 from public.bills where order_id = :'o2' \gset
select tests.issue(:'b1');

select is(
  (select gross || ' / ' || deduction || ' / ' || expected_net from public.bills where id = :'b1'),
  '69270.00 / 11083.20 / 58186.80',
  'issuing freezes the totals on the bill'
);
update public.projects set deduction_rate = 0.10 where id = :'reacts';
select is(
  (select deduction_rate from public.order_totals where order_id = :'o1'),
  0.1600::numeric,
  'a billed order keeps the rate it was billed at'
);
update public.projects set deduction_rate = 0.16 where id = :'reacts';
select is((select status from public.orders where id = :'o1'), 'billed'::public.order_status, 'the order is billed');

select tests.act_as(:'alice');
set constraints all immediate;

-- The bank SMS: BDT 58186.80 credited ... PBD2778470 (the PO without its hyphen).
insert into public.payments (received_on, amount, bank_reference, raw_sms)
values ('2026-09-29', 58186.80, 'PBD2778470', 'BDT 58186.80 has been credited ... PBD2778470 ...')
returning id as p1 \gset

select is(
  (select o.id from public.orders as o join public.payments as p on p.bank_reference_key = o.po_number_key where p.id = :'p1'),
  :'o1'::uuid,
  'the SMS reference finds the order by its PO number'
);
select throws_ok(
  format($q$ insert into public.payment_allocations (payment_id, bill_id, received_amount) values (%L, %L, 10) $q$, :'p1', :'b2'),
  'AMH01', 'bill_not_issued',
  'a payment cannot settle a bill that is not issued'
);
select throws_ok(
  format($q$ insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount) values (%L, %L, 60000, 0) $q$, :'p1', :'b1'),
  'AMH04', 'payment_over_allocated',
  'a payment cannot be spread wider than its amount'
);
select throws_ok(
  format($q$ insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount) values (%L, %L, 58186.80, 20000) $q$, :'p1', :'b1'),
  'AMH04', 'bill_over_settled',
  'and a bill cannot be settled beyond its gross'
);
select throws_ok(
  format($q$ insert into public.payment_allocations (payment_id, bill_id, received_amount) values (%L, %L, 0) $q$, :'p1', :'b1'),
  '23514', null,
  'an allocation settles something'
);

-- Half arrives first.
insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount)
values (:'p1', :'b1', 29093.40, 5541.60) returning id as a1 \gset
reset role;

select is((select status from public.orders where id = :'o1'), 'partially_paid'::public.order_status, 'a first payment makes the order partially paid');
select is(
  (select received || ' / ' || deducted || ' / ' || outstanding || ' / ' || expected_still from public.bill_balances where bill_id = :'b1'),
  '29093.40 / 5541.60 / 34635.00 / 29093.40',
  'the balance shows received, deducted, still owed (gross) and still expected (net)'
);

select tests.act_as(:'alice');
set constraints all immediate;
update public.payment_allocations set received_amount = 58186.80, deduction_amount = 11083.20 where id = :'a1';
reset role;

select is((select status from public.orders where id = :'o1'), 'paid'::public.order_status, 'settling the gross makes it paid');
select is(
  (select outstanding || ' / ' || expected_still || ' / ' || received_vs_expected from public.bill_balances where bill_id = :'b1'),
  '0.00 / 0.00 / 0.00',
  'nothing is owed and the bank got exactly what was expected'
);

select tests.act_as(:'alice');
set constraints all immediate;
select throws_ok(
  format($q$ update public.payments set amount = 50000 where id = %L $q$, :'p1'),
  'AMH04', 'payment_over_allocated',
  'a payment cannot shrink below what it settles'
);
delete from public.payment_allocations where id = :'a1';
reset role;
select is((select status from public.orders where id = :'o1'), 'billed'::public.order_status, 'removing the allocation makes the order billed again');

-- One payment, two bills; and a short payment ------------------------------------------------

select tests.act_as(:'alice');
update public.order_lines set bill_qty = null where id = :'l_lunch';
reset role;
select tests.issue(:'b2');
select is((select gross from public.bills where id = :'b2'), 3195.00::numeric, 'the second order is billed at ৳3,195');

select tests.act_as(:'alice');
set constraints all immediate;
insert into public.payments (received_on, amount) values ('2026-10-01', 61000.00) returning id as p2 \gset
insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount) values
  (:'p2', :'b1', 58186.80, 11083.20),
  (:'p2', :'b2', 2683.80, 511.20);
reset role;
select results_eq(
  format($q$ select status::text from public.orders where id in (%L, %L) order by number $q$, :'o1', :'o2'),
  $$ values ('paid'), ('paid') $$,
  'one payment settles two bills'
);

select tests.act_as(:'alice');
set constraints all immediate;
update public.payment_allocations set received_amount = 2600.00 where bill_id = :'b2';
reset role;
select is(
  (select received_vs_expected || ' / ' || outstanding from public.bill_balances where bill_id = :'b2'),
  '-83.80 / 83.80',
  'a short payment shows how much less the bank got than expected'
);
select is((select status from public.orders where id = :'o2'), 'partially_paid'::public.order_status, 'and leaves the order partly paid');

-- Revisions keep their payments --------------------------------------------------------------

insert into public.bills (order_id, revision, supersedes_bill_id, buyer_text)
values (:'o2', 1, :'b2', 'REACTS-IN Project') returning id as b2r1 \gset
update public.bills set state = 'superseded', closed_at = now() where id = :'b2';
select tests.issue(:'b2r1');
select is(
  (select received || ' / ' || number from public.bill_balances where order_id = :'o2'),
  '2600.00 / ' || (select number from public.bills where id = :'b2') || '-R1',
  'payments recorded against a bill count for its revision'
);

-- Age ------------------------------------------------------------------------------------------

alter table public.bills disable trigger t10_guard_bill;
update public.bills set issued_at = now() - interval '45 days' where id = :'b2r1';
alter table public.bills enable trigger t10_guard_bill;
select is(
  (select days_outstanding || ' / ' || age_bucket from public.bill_balances where bill_id = :'b2r1'),
  '45 / 31-60',
  'balances know how old the bill is'
);
select is(
  (select array_agg(distinct age_bucket order by age_bucket) from public.bill_balances where order_id in (:'o1', :'o2')),
  array['0-30', '31-60'],
  'and which age bucket it falls in'
);

-- Totals are server-side only ----------------------------------------------------------------

select tests.act_as(:'alice');
select throws_ok(
  format($q$ update public.bills set gross = 1 where id = %L $q$, :'b1'),
  '42501', null,
  'members cannot write a bill''s totals'
);
select ok(
  not has_table_privilege('authenticated', 'public.order_totals', 'insert, update, delete')
    and not has_table_privilege('authenticated', 'public.order_line_totals', 'insert, update, delete')
    and not has_table_privilege('authenticated', 'public.bill_balances', 'insert, update, delete'),
  'or the computed figures'
);
select ok(
  (select count(*) from public.bill_balances where order_id in (:'o1', :'o2')) = 2,
  'members read balances'
);
reset role;

-- Everyone else --------------------------------------------------------------------------------

select tests.act_as(:'stranger');
select is(
  (select count(*)::integer from public.payments) + (select count(*)::integer from public.payment_allocations)
    + (select count(*)::integer from public.bill_balances) + (select count(*)::integer from public.order_totals),
  0,
  'a non-member sees no payments, allocations, balances or totals'
);
reset role;
select tests.act_as_anon();
select throws_ok('select * from public.payments', '42501', null, 'anon cannot read payments at all');
select throws_ok('select * from public.bill_balances', '42501', null, 'or balances');
reset role;

select * from finish();
rollback;
