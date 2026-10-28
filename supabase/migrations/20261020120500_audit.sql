-- Audit log (BLUEPRINT §4, §5.9): who changed what, through which channel, before and after.
-- Triggers write it for every business table, so no change goes unrecorded, whoever makes it.
--
-- Server code says how a change was made with two transaction settings:
--   amh.channel   'ai' for the assistant, 'link' for delivery links (default: 'ui' for a signed-in
--                 member, 'system' otherwise)
--   amh.batch_id  a uuid shared by every change of one AI action, so it can be undone as a unit

create type public.audit_channel as enum ('ui', 'ai', 'system', 'link');
create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- The member who made the change; null for the system and for delivery links.
  actor uuid,
  channel public.audit_channel not null,
  action public.audit_action not null,
  entity_type text not null,
  entity_id uuid,
  -- The order a change belongs to, for the order's history tab.
  order_id uuid,
  before jsonb,
  after jsonb,
  batch_id uuid
);

create index audit_log_at_idx on public.audit_log (at desc, id desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, at desc);
create index audit_log_order_id_idx on public.audit_log (order_id, at desc) where order_id is not null;
create index audit_log_batch_id_idx on public.audit_log (batch_id) where batch_id is not null;
create index audit_log_actor_idx on public.audit_log (actor, at desc);

comment on table public.audit_log is
  'Every change to business data, written by triggers. Members read it; nobody edits it.';

-- Trigger arguments: the column that identifies the row ('' for none), and quiet columns that are
-- neither stored nor counted as a change (updated_at always is).
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(tg_argv[0], '');
  v_quiet text[] := array['updated_at'] || coalesce(tg_argv[1]::text[], array[]::text[]);
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_order_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_before := to_jsonb(old) - v_quiet;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_after := to_jsonb(new) - v_quiet;
  end if;
  if tg_op = 'UPDATE' and v_before = v_after then
    return null;
  end if;

  v_row := coalesce(v_after, v_before);
  v_order_id := case
    when tg_table_name = 'orders' then (v_row ->> 'id')::uuid
    when v_row ? 'order_id' then (v_row ->> 'order_id')::uuid
    when v_row ? 'bill_id' then (select order_id from public.bills where id = (v_row ->> 'bill_id')::uuid)
  end;

  insert into public.audit_log (actor, channel, action, entity_type, entity_id, order_id, before, after, batch_id)
  values (
    auth.uid(),
    coalesce(
      nullif(current_setting('amh.channel', true), '')::public.audit_channel,
      case when auth.uid() is null then 'system' else 'ui' end::public.audit_channel
    ),
    lower(tg_op)::public.audit_action,
    tg_table_name,
    case when v_key is null then null else (v_row ->> v_key)::uuid end,
    v_order_id,
    v_before,
    v_after,
    nullif(current_setting('amh.batch_id', true), '')::uuid
  );
  return null;
end;
$$;

create function private.audit_changes(p_table regclass, p_key text default 'id', p_quiet text[] default '{}')
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger t90_audit after insert or update or delete on %s for each row execute function private.audit_row_change(%L, %L)',
    p_table, coalesce(p_key, ''), p_quiet::text
  );
end;
$$;

-- Settings and people. Language and theme are personal preferences, not business changes.
select private.audit_changes('public.business_settings', '');
select private.audit_changes('public.profiles', 'id', '{language,theme}');

-- Directories. Package rate history needs no trail of its own: the package's change is logged.
select private.audit_changes('public.organisations');
select private.audit_changes('public.projects');
select private.audit_changes('public.log_codes');
select private.audit_changes('public.areas');
select private.audit_changes('public.locations');
select private.audit_changes('public.location_aliases');
select private.audit_changes('public.contacts');
select private.audit_changes('public.contact_locations');
select private.audit_changes('public.package_categories');
select private.audit_changes('public.packages');
select private.audit_changes('public.package_client_codes');

-- Orders and documents. An issued document's payload stays on its own immutable row.
select private.audit_changes('public.orders');
select private.audit_changes('public.order_lines');
select private.audit_changes('public.challans');
select private.audit_changes('public.challan_lines');
select private.audit_changes('public.summaries', 'order_id');
select private.audit_changes('public.order_files');
select private.audit_changes('public.bills');
select private.audit_changes('public.issued_documents', 'id', '{payload}');
select private.audit_changes('public.import_profiles');
select private.audit_changes('public.delivery_links');

-- Money.
select private.audit_changes('public.payments');
select private.audit_changes('public.payment_allocations');

-- Members read the trail (the activity feed, an order's history, the audit viewer); only the
-- triggers write it. Not even the service role may add, change or remove entries.
select private.grant_member_access('public.audit_log', 'select');
revoke insert, update, delete, truncate on table public.audit_log from service_role;
