-- Storage buckets and their policies, and the Realtime change feed.
begin;
\ir _setup.psql
select plan(13);

select results_eq(
  $$ select id, public from storage.buckets where id in ('order-files', 'issued-documents', 'branding', 'backups') order by id $$,
  $$ values ('backups', false), ('branding', false), ('issued-documents', false), ('order-files', false) $$,
  'the four buckets exist and none is public'
);
select ok(
  (select allowed_mime_types @> array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'application/pdf']
   from storage.buckets where id = 'order-files'),
  'order files take spreadsheets, photos and PDFs'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'issued-documents'),
  array['application/pdf'],
  'issued documents are PDFs only'
);

select tests.create_member('01711000001', 'আলিফ') as alice \gset
select tests.create_user() as stranger \gset

-- The Storage API writes these rows as the signed-in user, so RLS decides.
select tests.act_as(:'alice');
select lives_ok(
  format($q$ insert into storage.objects (bucket_id, name, owner_id) values ('order-files', 'orders/x/source.xlsx', %L) $q$, :'alice'),
  'members upload order files'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('branding', 'logo.png') $$,
  'and the logo'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('issued-documents', 'bills/forged.pdf') $$,
  '42501', null,
  'but cannot put a document among the issued ones'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('backups', 'forged.json') $$,
  '42501', null,
  'or among the backups'
);
reset role;

insert into storage.objects (bucket_id, name) values ('issued-documents', 'bills/real.pdf'), ('backups', 'weekly.json');

select tests.act_as(:'alice');
select is(
  (select count(*)::integer from storage.objects where bucket_id in ('issued-documents', 'backups')),
  2,
  'members read issued documents and backups'
);
select results_eq(
  $$ with changed as (update storage.objects set name = 'bills/changed.pdf' where bucket_id = 'issued-documents' returning 1) select count(*)::integer from changed $$,
  $$ values (0) $$,
  'but cannot change an issued document'
);
reset role;

select tests.act_as(:'stranger');
select is((select count(*)::integer from storage.objects), 0, 'a non-member sees no files');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('order-files', 'sneaky.pdf') $$,
  '42501', null,
  'and cannot upload'
);
reset role;

select tests.act_as_anon();
select is((select count(*)::integer from storage.objects), 0, 'anon sees no files');
reset role;

select is(
  (select string_agg(format('%s.%s', schemaname, tablename) collate "default", ', ' order by 1)
   from pg_publication_tables where pubname = 'supabase_realtime'),
  'public.audit_log',
  'Realtime carries the audit log, the one feed of every change'
);

select * from finish();
rollback;
