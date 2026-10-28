-- The audit log: every business table is covered; inserts, updates and deletes are recorded with
-- actor, channel and batch; no-op updates and personal preferences are not; nobody can edit it.
begin;
\ir _setup.psql
select plan(26);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and c.relname not in ('audit_log', 'package_rates')
     and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 't90_audit')),
  null,
  'every business table is audited (the log itself and derived rate history excepted)'
);

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_user() as stranger \gset

-- Inserts, updates, deletes --------------------------------------------------------------------

select tests.act_as(:'alice');
insert into public.organisations (name_en) values ('World Vision Bangladesh') returning id as wv \gset
reset role;

select is(
  (select actor || ' ' || channel || ' ' || action || ' ' || entity_type from public.audit_log where entity_id = :'wv'),
  :'alice' || ' ui insert organisations',
  'an insert records who did it, from the app'
);
select is(
  (select (before is null) and after ->> 'name_en' = 'World Vision Bangladesh' from public.audit_log where entity_id = :'wv'),
  true,
  'with the new row and no old one'
);

select tests.act_as(:'alice');
update public.organisations set notes = 'Main client' where id = :'wv';
update public.organisations set notes = 'Main client' where id = :'wv';
reset role;

select is(
  (select count(*)::integer from public.audit_log where entity_id = :'wv' and action = 'update'),
  1,
  'an update is recorded once; repeating it changes nothing and records nothing'
);
select is(
  (select (before ->> 'notes') || ' -> ' || (after ->> 'notes') from public.audit_log where entity_id = :'wv' and action = 'update'),
  ' -> Main client',
  'with what it was and what it became'
);
select ok(
  (select not (after ? 'updated_at') from public.audit_log where entity_id = :'wv' and action = 'update'),
  'bookkeeping columns are left out'
);

select tests.act_as(:'alice');
delete from public.organisations where id = :'wv';
reset role;
select is(
  (select (after is null) and before ->> 'notes' = 'Main client' from public.audit_log where entity_id = :'wv' and action = 'delete'),
  true,
  'a delete keeps the row as it was'
);

-- Channels and batches -------------------------------------------------------------------------

select tests.act_as(:'alice');
select set_config('amh.channel', 'ai', true);
select set_config('amh.batch_id', '7d5bd9c8-56c4-4ab5-8e2b-0c7a8f4c2f11', true);
insert into public.areas (name_en) values ('Nargun') returning id as nargun \gset
insert into public.areas (name_en) values ('Ruhia') returning id as ruhia \gset
select set_config('amh.channel', '', true);
select set_config('amh.batch_id', '', true);
reset role;

select is(
  (select count(*)::integer from public.audit_log where batch_id = '7d5bd9c8-56c4-4ab5-8e2b-0c7a8f4c2f11' and channel = 'ai' and actor = :'alice'),
  2,
  'an AI action''s changes share its batch, for undo'
);

select tests.act_as_service();
insert into public.areas (name_en) values ('Pirganj') returning id as pirganj \gset
reset role;
select is(
  (select coalesce(actor::text, 'nobody') || ' ' || channel from public.audit_log where entity_id = :'pirganj'),
  'nobody system',
  'a change without a signed-in member is the system''s'
);

-- Orders: every change knows its order ---------------------------------------------------------

insert into public.organisations (name_en) values ('World Vision Bangladesh') returning id as wv2 \gset
insert into public.projects (organisation_id, name_en, billing_buyer_name) values (:'wv2', 'Thakurgaon AP', 'Thakurgaon AP World Vision')
returning id as ap \gset

select tests.act_as(:'alice');
insert into public.orders (project_id, title) values (:'ap', 'August') returning id as o1 \gset
insert into public.order_lines (order_id, name, items, rate) values (:'o1', 'Lunch', '[{"en": "Rice"}]', 355) returning id as l1 \gset
insert into public.challans (order_id, delivery_date) values (:'o1', '2026-08-13') returning id as c1 \gset
insert into public.challan_lines (challan_id, order_line_id, qty) values (:'c1', :'l1', 12);
insert into public.summaries (order_id) values (:'o1');
reset role;

select results_eq(
  format($q$ select entity_type from public.audit_log where order_id = %L order by id $q$, :'o1'),
  $$ values ('orders'), ('bills'), ('order_lines'), ('challans'), ('challan_lines'), ('summaries') $$,
  'an order''s history lists the order, its bill, lines, challans, quantities and summary, in order'
);
select is(
  (select entity_id from public.audit_log where entity_type = 'summaries' and order_id = :'o1'),
  :'o1'::uuid,
  'the summary is known by its order'
);

-- Payments find their order through the bill.
select id as b1 from public.bills where order_id = :'o1' \gset
update public.bills
set state = 'issued', fiscal_year = '26-27', seq = 1, number = 'AMH/26-27/B-0001', gross = 4260,
  deduction_rate = 0.16, deduction = 681.60, expected_net = 3578.40, amount_in_words = 'x', issued_at = now()
where id = :'b1';
select set_config('amh.system_change', 'on', true);
update public.orders set status = 'billed' where id = :'o1';
select set_config('amh.system_change', '', true);

select tests.act_as(:'alice');
insert into public.payments (received_on, amount) values ('2026-09-29', 3578.40) returning id as p1 \gset
insert into public.payment_allocations (payment_id, bill_id, received_amount, deduction_amount)
values (:'p1', :'b1', 3578.40, 681.60) returning id as a1 \gset
reset role;

select is(
  (select order_id from public.audit_log where entity_id = :'a1'),
  :'o1'::uuid,
  'an allocation''s change belongs to its bill''s order'
);
select results_eq(
  format($q$ select entity_type || ':' || action from public.audit_log where order_id = %L and id > (select max(id) from public.audit_log where entity_type = 'payments') order by id $q$, :'o1'),
  $$ values ('payment_allocations:insert'), ('orders:update') $$,
  'and the log shows the allocation before the paid status it caused'
);

-- Quiet columns --------------------------------------------------------------------------------

select tests.act_as(:'alice');
update public.profiles set language = 'en', theme = 'dark' where id = :'alice';
reset role;
select is(
  (select count(*)::integer from public.audit_log where entity_id = :'alice' and action = 'update'),
  0,
  'changing language or theme is not a business change'
);
select tests.act_as(:'alice');
update public.profiles set display_name_en = 'Alif', language = 'bn' where id = :'alice';
reset role;
select is(
  (select (after ->> 'display_name_en') || ' ' || (after ? 'language')::text from public.audit_log where entity_id = :'alice' and action = 'update'),
  'Alif false',
  'changing a name is, and preferences stay out of the record'
);

insert into public.issued_documents (bill_id, kind, storage_path, sha256, page_count, byte_size, payload)
values (:'b1', 'bill', 'x/bill.pdf', repeat('a', 64), 1, 100, '{"pages": [1, 2, 3]}') returning id as doc \gset
select is(
  (select (after ? 'payload')::text || ' ' || (after ->> 'kind') from public.audit_log where entity_id = :'doc'),
  'false bill',
  'an issued document is logged without repeating its payload'
);

update public.business_settings set tagline_en = 'Audited';
select is(
  (select count(*)::integer from public.audit_log where entity_type = 'business_settings' and at = now()),
  1,
  'settings changes are recorded too'
);

-- Nobody edits the log -------------------------------------------------------------------------

select tests.act_as(:'alice');
select ok((select count(*) from public.audit_log) > 0, 'members read the log');
select throws_ok(
  $$ insert into public.audit_log (channel, action, entity_type) values ('ui', 'insert', 'orders') $$,
  '42501', null,
  'members cannot write to it'
);
select throws_ok($$ update public.audit_log set actor = null $$, '42501', null, 'or change it');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'or clear it');
reset role;

select tests.act_as_service();
select throws_ok(
  $$ insert into public.audit_log (channel, action, entity_type) values ('ui', 'insert', 'orders') $$,
  '42501', null,
  'nor can the server, except through the triggers'
);
reset role;

select tests.act_as(:'stranger');
select is((select count(*)::integer from public.audit_log), 0, 'a non-member sees none of it');
reset role;
select tests.act_as_anon();
select throws_ok('select * from public.audit_log', '42501', null, 'and anon cannot read it at all');
reset role;

-- Bad settings fail loudly instead of writing a wrong trail.
select set_config('amh.channel', 'carrier-pigeon', true);
select throws_ok(
  $$ insert into public.areas (name_en) values ('Nowhere') $$,
  '22P02', null,
  'an unknown channel stops the change'
);
select set_config('amh.channel', '', true);
select is(
  (select count(*)::integer from public.areas where name_en = 'Nowhere'),
  0,
  'and nothing is written'
);

select * from finish();
rollback;
