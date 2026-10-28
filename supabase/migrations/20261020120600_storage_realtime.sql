-- Files and live updates (BLUEPRINT §2.8, §4, §5.9).
--
-- Storage buckets, all private (no public URLs; members get signed URLs):
--   order-files       orders' source files (Excel, CSV, PDF, photos) and photos of signed challans
--   issued-documents  every PDF made at issue: the server writes them, members only read
--   branding          the logo and header artwork that documents print
--   backups           weekly and manual exports: the server writes them, members only read
-- Buckets without a size limit use the project's upload limit.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  (
    'order-files', 'order-files', false, 26214400,
    array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'
    ]
  ),
  ('issued-documents', 'issued-documents', false, null, array['application/pdf']),
  ('branding', 'branding', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  (
    'backups', 'backups', false, null,
    array['application/json', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  );

create policy amh_members_order_files on storage.objects
  for all to authenticated
  using (bucket_id = 'order-files' and (select private.is_member()))
  with check (bucket_id = 'order-files' and (select private.is_member()));

create policy amh_members_branding on storage.objects
  for all to authenticated
  using (bucket_id = 'branding' and (select private.is_member()))
  with check (bucket_id = 'branding' and (select private.is_member()));

create policy amh_members_read_issued_documents on storage.objects
  for select to authenticated
  using (bucket_id = 'issued-documents' and (select private.is_member()));

create policy amh_members_read_backups on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (select private.is_member()));

-- Live by default: every change to business data writes an audit row naming its table, row and
-- order, so one Realtime subscription to the audit log tells every open device what to refresh
-- and what to highlight. RLS applies to Realtime too: only members receive changes.
alter publication supabase_realtime add table public.audit_log;
