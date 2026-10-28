-- Orders, challans and bills: numbering, status rules, the package snapshot, issued-means-locked,
-- one bill per order, revisions and issued documents.
begin;
\ir _setup.psql
select plan(68);

-- Fixtures, made by the test runner -----------------------------------------------------------

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select private.current_fiscal_year() as fy \gset
select tests.create_user() as stranger \gset

insert into public.organisations (name_en) values ('World Vision Bangladesh') returning id as wv \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name, billing_address)
values (:'wv', 'Thakurgaon AP', 'Thakurgaon AP World Vision', 'Thakurgaon') returning id as ap \gset
insert into public.locations (name_en, name_bn) values ('Bandigor Club', 'বন্দিগড় ক্লাব') returning id as bandigor \gset
insert into public.log_codes (project_id, code) values (:'ap', '143.03.13') returning id as code13 \gset
insert into public.package_categories (name_en) values ('Snacks Basic') returning id as snacks \gset
insert into public.packages (name, category_id, rate, items)
values ('Snacks Basic-03', :'snacks', 100, '[{"en": "Plain Cake — 1 pc"}, {"en": "Banana — 1 pc"}]')
returning id as basic03 \gset
insert into public.packages (name, category_id, rate, items)
values ('Snacks Basic-02', :'snacks', 50, '[{"en": "Biscuit — 62 g ±"}]')
returning id as basic02 \gset

-- Marks a bill issued the way the issue step (Segment 5) will: number, frozen money, timestamp.
create function tests.issue(p_bill_id uuid, p_gross numeric default 1000, p_on date default private.dhaka_today())
returns text
language plpgsql
as $$
declare
  v record;
begin
  select * into v from private.bill_number_for(p_bill_id, p_on);
  update public.bills
  set state = 'issued', fiscal_year = v.fiscal_year, seq = v.seq, number = v.number,
    gross = p_gross, deduction_rate = 0.16, deduction = round(p_gross * 0.16, 2),
    expected_net = p_gross - round(p_gross * 0.16, 2), amount_in_words = 'Test', issued_at = now()
  where id = p_bill_id;
  return v.number;
end;
$$;

-- Opens a revision of an order's issued bill, as Revise (Segment 5) will.
create function tests.revise(p_order_id uuid)
returns uuid
language sql
as $$
  insert into public.bills (order_id, revision, supersedes_bill_id, buyer_text, address_text)
  select order_id, revision + 1, id, buyer_text, address_text
  from public.bills where order_id = p_order_id and state = 'issued'
  returning id
$$;

-- Orders: numbers and status ------------------------------------------------------------------

select tests.act_as(:'alice');

insert into public.orders (project_id, title, po_number) values (:'ap', 'August snacks', 'PBD-2794325')
returning id as o1, number as o1_number \gset
insert into public.orders (project_id, title) values (:'ap', 'September lunch') returning id as o2 \gset

select is(:'o1_number', 'AMH/' || :'fy' || '/0001', 'the first order of the year is 0001');
select is(
  (select number from public.orders where id = :'o2'),
  'AMH/' || :'fy' || '/0002',
  'the next one is 0002'
);
select is((select po_number_key from public.orders where id = :'o1'), 'PBD2794325', 'the PO number is kept in the form bank SMS use');
select throws_ok(
  format($q$ insert into public.orders (project_id, number) values (%L, 'AMH/26-27/9999') $q$, :'ap'),
  '42501', null,
  'members cannot choose an order number'
);
select throws_ok(
  format($q$ update public.orders set seq = 99 where id = %L $q$, :'o1'),
  '42501', null,
  'or change one'
);
select is(
  (select count(*)::integer from public.bills where order_id = :'o1' and state = 'draft' and revision = 0),
  1,
  'every new order comes with its draft bill'
);
select is(
  (select buyer_text || ' / ' || address_text from public.bills where order_id = :'o1'),
  'Thakurgaon AP World Vision / Thakurgaon',
  'the bill''s header starts from the client''s billing name and address'
);
select throws_ok(
  format($q$ insert into public.orders (project_id, status) values (%L, 'billed') $q$, :'ap'),
  'AMH03', 'status_change_not_allowed',
  'a new order cannot start as billed'
);
select lives_ok(
  format($q$ update public.orders set status = 'confirmed' where id = %L $q$, :'o1'),
  'people confirm an order'
);
select throws_ok(
  format($q$ update public.orders set status = 'paid' where id = %L $q$, :'o1'),
  'AMH03', 'status_change_not_allowed',
  'but cannot mark it paid by hand'
);
select lives_ok(
  format($q$ update public.orders set status = 'cancelled' where id = %L $q$, :'o2'),
  'people cancel an order that is not billed'
);
select lives_ok(
  format($q$ update public.orders set status = 'draft' where id = %L $q$, :'o2'),
  'and reopen it'
);
select throws_ok(
  format($q$ update public.orders set date_from = '2026-09-10', date_to = '2026-09-01' where id = %L $q$, :'o1'),
  '23514', null,
  'an order cannot end before it starts'
);
reset role;

select throws_ok(
  format($q$ update public.orders set number = 'AMH/26-27/0099' where id = %L $q$, :'o1'),
  'AMH02', 'number_immutable',
  'not even the server can renumber an order'
);
select set_config('amh.system_change', 'on', true);
select lives_ok(
  format($q$ update public.orders set status = 'delivering' where id = %L $q$, :'o1'),
  'server functions move an order on when it starts delivering'
);
select set_config('amh.system_change', '', true);

-- Lines: the package snapshot ------------------------------------------------------------------

select tests.act_as(:'alice');

insert into public.order_lines (order_id, package_id) values (:'o1', :'basic03') returning id as l1 \gset
insert into public.order_lines (order_id, package_id) values (:'o1', :'basic02') returning id as l2 \gset

select is(
  (select name || ' @ ' || rate || ' / ' || jsonb_array_length(items) from public.order_lines where id = :'l1'),
  'Snacks Basic-03 @ 100.00 / 2',
  'a line copies the package''s name, rate and items'
);
select is(
  (select array_agg(position order by position) from public.order_lines where order_id = :'o1'),
  array[1, 2],
  'new lines go to the end'
);
reset role;
update public.packages set rate = 120, items = '[{"en": "Changed"}]' where id = :'basic03';
select tests.act_as(:'alice');
select is(
  (select rate || ' / ' || (items -> 0 ->> 'en') from public.order_lines where id = :'l1'),
  '100.00 / Plain Cake — 1 pc',
  'changing the package later leaves the order as it was'
);
select lives_ok(
  format($q$ insert into public.order_lines (order_id, package_id, rate) values (%L, %L, 95) $q$, :'o2', :'basic03'),
  'a line can take an agreed rate (a PO''s) instead of the list rate'
);
select throws_ok(
  format($q$ insert into public.order_lines (order_id, name, rate) values (%L, 'Custom', 10) $q$, :'o2'),
  '23502', null,
  'a line without a package needs its own items'
);

-- Challans ------------------------------------------------------------------------------------

insert into public.challans (order_id, delivery_date, location_id, log_code_id)
values (:'o1', '2026-08-13', :'bandigor', :'code13') returning id as c1, number as c1_number \gset
insert into public.challans (order_id, delivery_date, address_text) values (:'o1', '2026-08-16', 'Danarhat')
returning id as c2 \gset
insert into public.challans (order_id, delivery_date) values (:'o2', '2026-09-01') returning number as other_number \gset

select is(:'c1_number'::integer, 1, 'an order''s first challan is number 1');
select is((select number from public.challans where id = :'c2'), 2, 'the next is 2');
select is(:'other_number'::integer, 1, 'each order counts its own challans');
select is(
  (select buyer_text || ' / ' || address_text || ' / ' || log_code_text from public.challans where id = :'c1'),
  'Thakurgaon AP World Vision / Bandigor Club / 143.03.13',
  'the printed header comes from the client, the place and the log code'
);
select is((select address_text from public.challans where id = :'c2'), 'Danarhat', 'typed header text is kept');

delete from public.challans where id = :'c2';
insert into public.challans (order_id, delivery_date) values (:'o1', '2026-08-17') returning number as c3_number \gset
select is(:'c3_number'::integer, 3, 'a deleted challan''s number is not reused');
select throws_ok(
  format($q$ update public.challans set number = 7 where id = %L $q$, :'c1'),
  '42501', null,
  'members cannot renumber a challan'
);
select throws_ok(
  format($q$ update public.challans set delivered_at = now() where id = %L $q$, :'c1'),
  '23514', null,
  'a delivery records how it was marked'
);

-- Quantities
insert into public.challan_lines (challan_id, order_line_id, qty, qty_input) values (:'c1', :'l1', 12, '10+2')
returning order_id as cl_order \gset
select is(:'cl_order'::uuid, :'o1'::uuid, 'a quantity belongs to the challan''s order');
select throws_ok(
  format(
    $q$ insert into public.challan_lines (challan_id, order_line_id, qty) values (%L, (select id from public.order_lines where order_id = %L limit 1), 1) $q$,
    :'c1', :'o2'
  ),
  '23503', null,
  'a challan cannot carry another order''s line'
);
select lives_ok(
  format(
    $q$ insert into public.challan_lines (challan_id, order_line_id, qty) values (%L, %L, 15)
        on conflict (challan_id, order_line_id) do update set qty = excluded.qty $q$,
    :'c1', :'l1'
  ),
  'members upsert a quantity'
);
select is(
  (select qty from public.challan_lines where challan_id = :'c1' and order_line_id = :'l1'),
  15,
  'and the cell has one value'
);
select throws_ok(
  format($q$ insert into public.challan_lines (challan_id, order_line_id, qty) values (%L, %L, -1) $q$, :'c1', :'l2'),
  '23514', null,
  'quantities are never negative'
);
insert into public.summaries (order_id) values (:'o1');
reset role;

-- Issued means locked -------------------------------------------------------------------------

select id as b1 from public.bills where order_id = :'o1' \gset
select tests.issue(:'b1') as b1_number \gset

select tests.act_as(:'alice');
select throws_ok(
  format($q$ update public.order_lines set rate = 1 where id = %L $q$, :'l1'),
  'AMH01', 'order_locked',
  'an issued order''s lines cannot change'
);
select throws_ok(
  format($q$ insert into public.order_lines (order_id, package_id) values (%L, %L) $q$, :'o1', :'basic02'),
  'AMH01', 'order_locked',
  'or be added'
);
select throws_ok(
  format($q$ delete from public.order_lines where id = %L $q$, :'l2'),
  'AMH01', 'order_locked',
  'or removed'
);
select throws_ok(
  format($q$ update public.challans set address_text = 'Elsewhere' where id = %L $q$, :'c1'),
  'AMH01', 'order_locked',
  'its challans cannot change'
);
select throws_ok(
  format($q$ insert into public.challans (order_id, delivery_date) values (%L, '2026-08-20') $q$, :'o1'),
  'AMH01', 'order_locked',
  'or be added'
);
select throws_ok(
  format($q$ delete from public.challans where id = %L $q$, :'c1'),
  'AMH01', 'order_locked',
  'or removed'
);
select lives_ok(
  format($q$ update public.challans set delivered_at = now(), delivered_via = 'ui', signed_returned = true where id = %L $q$, :'c1'),
  'but deliveries and signed copies are still recorded'
);
select throws_ok(
  format($q$ update public.challan_lines set qty = 1 where challan_id = %L $q$, :'c1'),
  'AMH01', 'order_locked',
  'its quantities cannot change'
);
select throws_ok(
  format($q$ update public.summaries set buyer_text = 'x' where order_id = %L $q$, :'o1'),
  'AMH01', 'order_locked',
  'nor its summary'
);
select throws_ok(
  format($q$ update public.bills set buyer_text = 'x' where id = %L $q$, :'b1'),
  'AMH01', 'bill_locked',
  'nor the issued bill'
);
select lives_ok(
  format($q$ update public.orders set title = 'August snacks (AP)', notes = 'Paid late' where id = %L $q$, :'o1'),
  'the order''s title and notes stay editable'
);
select lives_ok(
  format($q$ update public.orders set entry_mode = 'page_editor' where id = %L $q$, :'o2'),
  'other orders are not affected'
);
select throws_ok(
  format($q$ update public.orders set entry_mode = 'page_editor' where id = %L $q$, :'o1'),
  'AMH01', 'order_locked',
  'but not how its documents are made'
);
select throws_ok(
  format($q$ delete from public.orders where id = %L $q$, :'o1'),
  'AMH01', null,
  'and an order with an issued bill cannot be deleted'
);
reset role;

select throws_ok(
  format($q$ delete from public.bills where id = %L $q$, :'b1'),
  'AMH01', 'bill_locked',
  'not even the server deletes an issued bill'
);
select throws_ok(
  format($q$ update public.bills set gross = 1 where id = %L $q$, :'b1'),
  'AMH01', 'bill_locked',
  'or changes what it says'
);

-- Revisions -----------------------------------------------------------------------------------

select tests.revise(:'o1') as b1r1 \gset
select tests.act_as(:'alice');
select lives_ok(
  format($q$ update public.order_lines set rate = 110 where id = %L $q$, :'l1'),
  'a revision opens the order for changes'
);
reset role;
select throws_ok(
  format($q$ insert into public.bills (order_id, revision, supersedes_bill_id) values (%L, 2, %L) $q$, :'o1', :'b1r1'),
  '23505', null,
  'an order has one open revision at a time'
);
select throws_ok(
  format($q$ select tests.issue(%L) $q$, :'b1r1'),
  '23505', null,
  'and one issued bill: the old one must be replaced first'
);
update public.bills set state = 'superseded', closed_at = now() where id = :'b1';
select is(tests.issue(:'b1r1'), :'b1_number' || '-R1', 'the revision keeps the bill''s number and adds R1');
select throws_ok(
  format($q$ update public.bills set state = 'issued', closed_at = null where id = %L $q$, :'b1'),
  'AMH01', 'bill_locked',
  'a replaced bill stays replaced'
);
select is(
  (select count(*)::integer from public.bills where order_id = :'o1'),
  2,
  'the original stays in history next to its revision'
);

-- Bill numbers --------------------------------------------------------------------------------

select is(
  :'b1_number',
  'AMH/' || :'fy' || '/B-0001',
  'the first bill of the year is B-0001, counted apart from orders'
);
select id as b2 from public.bills where order_id = :'o2' \gset
select is(
  (select number from private.bill_number_for(:'b2', private.dhaka_today())),
  'AMH/' || :'fy' || '/B-0002',
  'bills count up in the order they are issued'
);
select is(
  (select number from private.bill_number_for(:'b2', '2027-07-01')),
  'AMH/27-28/B-0001',
  'a bill issued in July starts the new year''s count, whenever its order came'
);
select throws_ok(
  format($q$ update public.bills set state = 'issued', issued_at = now() where id = %L $q$, :'b2'),
  '23514', null,
  'a bill cannot be issued without its number and frozen totals'
);
select throws_ok(
  format(
    $q$ update public.bills set state = 'issued', fiscal_year = '26-27', seq = 50, number = 'X', gross = 100,
        deduction_rate = 0.16, deduction = 15, expected_net = 85, amount_in_words = 'x', issued_at = now() where id = %L $q$,
    :'b2'
  ),
  '23514', null,
  'and its deduction must be the rate applied to the gross'
);

-- Issued documents ----------------------------------------------------------------------------

insert into public.issued_documents (bill_id, kind, storage_path, sha256, page_count, byte_size, payload)
values (:'b1r1', 'bill', 'test/bill.pdf', repeat('a', 64), 1, 1000, '{}')
returning id as doc \gset
select throws_ok(
  format(
    $q$ insert into public.issued_documents (bill_id, kind, storage_path, sha256, page_count, byte_size, payload)
        values (%L, 'bill', 'test/draft.pdf', repeat('b', 64), 1, 1, '{}') $q$,
    :'b2'
  ),
  'AMH01', 'bill_not_issued',
  'documents are stored only for issued bills'
);
select throws_ok(
  format($q$ update public.issued_documents set page_count = 2 where id = %L $q$, :'doc'),
  'AMH01', 'issued_document_immutable',
  'an issued document never changes'
);
select throws_ok(
  format($q$ delete from public.issued_documents where id = %L $q$, :'doc'),
  'AMH01', 'issued_document_immutable',
  'or disappears'
);

select tests.act_as(:'alice');
select is((select count(*)::integer from public.issued_documents), 1, 'members see issued documents');
select throws_ok(
  format(
    $q$ insert into public.issued_documents (bill_id, kind, storage_path, sha256, page_count, byte_size, payload)
        values (%L, 'bill', 'x.pdf', repeat('c', 64), 1, 1, '{}') $q$,
    :'b1r1'
  ),
  '42501', null,
  'but only the server stores them'
);
select throws_ok(
  format($q$ insert into public.bills (order_id, revision, supersedes_bill_id) values (%L, 5, %L) $q$, :'o1', :'b1r1'),
  '42501', null,
  'and only the server opens revisions'
);
reset role;

-- Everyone else -------------------------------------------------------------------------------

select tests.act_as(:'stranger');
select is(
  (select count(*)::integer from public.orders) + (select count(*)::integer from public.bills)
    + (select count(*)::integer from public.challans),
  0,
  'a non-member sees no orders, bills or challans'
);
reset role;
select tests.act_as_anon();
select throws_ok('select * from public.orders', '42501', null, 'anon cannot read orders at all');
reset role;

select * from finish();
rollback;
