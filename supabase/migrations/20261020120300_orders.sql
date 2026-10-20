-- Orders, deliveries and bills (BLUEPRINT §2, §4): the order and its package snapshot lines, one
-- challan per delivery with its quantities, the optional summary page, attached files, the bill
-- with its revisions, every issued PDF, import mappings and delivery links.
--
-- Invariants enforced here, whoever writes (BLUEPRINT §2; CLAUDE.md):
--   * Snapshot: a line copies its package's name, items and rate when it is added, and documents
--     print the copy. Later package edits never reach an existing order.
--   * Issued means locked: while an order's bill is issued and no revision is open, its lines,
--     challans, quantities, summary and bill cannot change. Delivery and signed-copy tracking stay
--     open. Issued bills and issued documents are never edited or deleted.
--   * One bill per order: the bill row exists from the moment the order does; an order has at most
--     one issued bill and at most one draft revision at a time.
--   * Numbers: an order is numbered when it is created and a challan gets a short number that is
--     stable within its order; neither ever changes.
--
-- Errors raised for these rules use SQLSTATE codes the app can recognise:
--   AMH01 locked (order_locked, bill_locked, issued_document_immutable, bill_not_issued)
--   AMH02 immutable identity (number_immutable)
--   AMH03 status change not allowed (status_change_not_allowed)

create type public.order_status as enum (
  'draft', 'confirmed', 'delivering', 'billed', 'partially_paid', 'paid', 'cancelled'
);
create type public.order_source as enum ('excel', 'pdf', 'photo', 'phone', 'manual');
create type public.entry_mode as enum ('schedule', 'page_editor');
create type public.delivery_channel as enum ('ui', 'link');
create type public.order_file_kind as enum ('source', 'signed_challan', 'other');
create type public.bill_state as enum ('draft', 'issued', 'superseded', 'void');
create type public.document_kind as enum ('bill', 'challans', 'summary', 'bundle');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Assigned on insert from today's fiscal year (Asia/Dhaka) and never changed.
  fiscal_year text not null,
  seq integer not null constraint orders_seq_positive check (seq > 0),
  number text not null constraint orders_number_key unique,
  project_id uuid not null references public.projects (id) on delete restrict,
  title text not null default '',
  -- As written on the PO (PBD-2794325); the key (PBD2794325) is what bank SMS carry.
  po_number text,
  po_number_key text generated always as (private.reference_key(po_number)) stored,
  internal_ref text,
  source public.order_source not null default 'manual',
  entry_mode public.entry_mode not null default 'schedule',
  status public.order_status not null default 'draft',
  date_from date,
  date_to date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  constraint orders_fiscal_year_seq_key unique (fiscal_year, seq),
  constraint orders_date_range check (date_to >= date_from)
);

create index orders_project_id_idx on public.orders (project_id);
create index orders_po_number_key_idx on public.orders (po_number_key) where po_number_key is not null;
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_created_by_idx on public.orders (created_by);

-- The package snapshot an order bills.
create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- For reports only: documents print the copies below.
  package_id uuid references public.packages (id) on delete restrict,
  name text not null constraint order_lines_name_present check (btrim(name) <> ''),
  items jsonb not null constraint order_lines_items_shape check (private.is_item_list(items)),
  rate numeric(10, 2) not null constraint order_lines_rate_not_negative check (rate >= 0),
  position integer not null,
  -- Null: the bill quantity is the sum of the challans. Typed in page-editor mode; a difference
  -- from the challans is shown, never hidden.
  bill_qty integer constraint order_lines_bill_qty_not_negative check (bill_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_lines_id_order_key unique (id, order_id)
);

create index order_lines_order_id_idx on public.order_lines (order_id, position);
create index order_lines_package_id_idx on public.order_lines (package_id);

-- One delivery: a date and a place.
create table public.challans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Stable within the order: assigned on insert, never renumbered, not reused after a delete.
  number integer not null constraint challans_number_positive check (number > 0),
  delivery_date date not null,
  delivery_time time,
  location_id uuid references public.locations (id) on delete restrict,
  log_code_id uuid references public.log_codes (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete restrict,
  -- The printed header, defaulted from the fields above and editable on the page.
  buyer_text text not null default '',
  address_text text not null default '',
  log_code_text text not null default '',
  position integer not null default 0,
  delivered_at timestamptz,
  delivered_via public.delivery_channel,
  signed_returned boolean not null default false,
  signed_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challans_order_number_key unique (order_id, number),
  constraint challans_id_order_key unique (id, order_id),
  constraint challans_delivery_recorded check ((delivered_at is null) = (delivered_via is null))
);

create index challans_order_date_idx on public.challans (order_id, delivery_date, position);
create index challans_delivery_date_idx on public.challans (delivery_date);
create index challans_location_id_idx on public.challans (location_id);
create index challans_log_code_id_idx on public.challans (log_code_id);
create index challans_contact_id_idx on public.challans (contact_id);

-- A quantity of one order line on one challan. No row, or a null quantity, prints blank.
-- order_id is filled in from the challan; the two composite keys keep both parents in one order.
create table public.challan_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  challan_id uuid not null,
  order_line_id uuid not null,
  qty integer constraint challan_lines_qty_not_negative check (qty >= 0),
  -- What was typed, e.g. 10+2 for 12.
  qty_input text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challan_lines_challan_fkey foreign key (challan_id, order_id)
    references public.challans (id, order_id) on delete cascade,
  constraint challan_lines_order_line_fkey foreign key (order_line_id, order_id)
    references public.order_lines (id, order_id) on delete cascade,
  constraint challan_lines_key unique (challan_id, order_line_id)
);

create index challan_lines_order_line_id_idx on public.challan_lines (order_line_id, order_id);

-- The summary page (at most one per order). Its quantities come from the challans; only the
-- printed header is stored.
create table public.summaries (
  order_id uuid primary key references public.orders (id) on delete cascade,
  buyer_text text not null default '',
  address_text text not null default '',
  log_code_text text not null default '',
  summary_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Files attached to an order: its source (Excel, PDF, photo) and photos of signed challans.
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  challan_id uuid,
  kind public.order_file_kind not null,
  -- In the private order-files bucket.
  storage_path text not null constraint order_files_storage_path_key unique,
  filename text not null,
  mime_type text not null,
  byte_size bigint not null constraint order_files_byte_size_not_negative check (byte_size >= 0),
  sha256 text not null constraint order_files_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  constraint order_files_challan_fkey foreign key (challan_id, order_id)
    references public.challans (id, order_id) on delete set null (challan_id)
);

create index order_files_order_id_idx on public.order_files (order_id);
create index order_files_challan_id_idx on public.order_files (challan_id, order_id);
create index order_files_created_by_idx on public.order_files (created_by);

-- The bill. Revision 0 is the original; Revise adds revision n+1 as a draft that replaces the
-- issued one when it is issued.
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  revision integer not null default 0 constraint bills_revision_not_negative check (revision >= 0),
  state public.bill_state not null default 'draft',
  supersedes_bill_id uuid references public.bills (id) on delete restrict,
  -- Allocated at issue: the fiscal year of the issue date and the next number in it. Revisions
  -- keep their original's fiscal year and number and add -Rn.
  fiscal_year text,
  seq integer constraint bills_seq_positive check (seq > 0),
  number text constraint bills_number_key unique,
  -- The printed header; editable while the bill is a draft.
  buyer_text text not null default '',
  address_text text not null default '',
  bill_date date,
  serial_text text not null default '',
  -- Frozen at issue, so an issued bill never changes.
  gross numeric(12, 2),
  deduction_rate numeric(5, 4),
  deduction numeric(12, 2),
  expected_net numeric(12, 2),
  amount_in_words text,
  issued_at timestamptz,
  issued_by uuid references public.profiles (id) on delete set null,
  -- When a newer revision replaced this one, or it was voided.
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_order_revision_key unique (order_id, revision),
  constraint bills_revision_link check ((revision = 0) = (supersedes_bill_id is null)),
  constraint bills_draft_unissued check (
    state <> 'draft'
    or num_nonnulls(fiscal_year, seq, number, gross, deduction_rate, deduction, expected_net, amount_in_words, issued_at) = 0
  ),
  constraint bills_issued_complete check (
    state = 'draft'
    or num_nulls(fiscal_year, seq, number, gross, deduction_rate, deduction, expected_net, amount_in_words, issued_at) = 0
  ),
  -- Money math in one place: deduction = round(gross × rate), expected net = gross − deduction.
  constraint bills_money_consistent check (
    gross is null
    or (deduction = round(gross * deduction_rate, 2) and expected_net = gross - deduction)
  ),
  constraint bills_closed_when_replaced check ((state in ('superseded', 'void')) = (closed_at is not null))
);

create unique index bills_one_issued_per_order on public.bills (order_id) where state = 'issued';
create unique index bills_one_draft_per_order on public.bills (order_id) where state = 'draft';
create unique index bills_supersedes_key on public.bills (supersedes_bill_id) where supersedes_bill_id is not null;
create index bills_issued_by_idx on public.bills (issued_by);

-- Every PDF made when a bill was issued, with the exact data it was rendered from.
create table public.issued_documents (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete restrict,
  kind public.document_kind not null,
  -- In the private issued-documents bucket.
  storage_path text not null constraint issued_documents_storage_path_key unique,
  sha256 text not null constraint issued_documents_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer not null constraint issued_documents_page_count_positive check (page_count > 0),
  byte_size bigint not null constraint issued_documents_byte_size_not_negative check (byte_size >= 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index issued_documents_bill_id_idx on public.issued_documents (bill_id);
create index issued_documents_created_by_idx on public.issued_documents (created_by);

-- Remembered column-header -> package mappings, so next month's file maps itself.
create table public.import_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source public.order_source not null,
  -- {"Lunch-430": "<package id>"}
  header_map jsonb not null default '{}'
    constraint import_profiles_header_map_shape check (jsonb_typeof(header_map) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_profiles_key unique (project_id, source)
);

-- A no-login link for one order and day (optionally one area). Only the token's SHA-256 is kept.
create table public.delivery_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  token_hash text not null
    constraint delivery_links_token_hash_key unique
    constraint delivery_links_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  delivery_date date not null,
  area_id uuid references public.areas (id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index delivery_links_order_id_idx on public.delivery_links (order_id, delivery_date);
create index delivery_links_area_id_idx on public.delivery_links (area_id);
create index delivery_links_created_by_idx on public.delivery_links (created_by);

-- ---------------------------------------------------------------------------------------------
-- Status rules
-- ---------------------------------------------------------------------------------------------

-- People move orders between draft and confirmed, cancel them before they are billed, and reopen
-- cancelled ones. Every other change (delivering, billed, partially paid, paid) is made by the
-- server functions that know it happened; they set amh.system_change for their transaction.
create function private.status_change_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('amh.system_change', true), '') = 'on'
    or (p_from::text, p_to::text) in (
      ('draft', 'confirmed'), ('confirmed', 'draft'),
      ('draft', 'cancelled'), ('confirmed', 'cancelled'), ('delivering', 'cancelled'),
      ('cancelled', 'draft')
    )
$$;

-- ---------------------------------------------------------------------------------------------
-- Locking
-- ---------------------------------------------------------------------------------------------

-- Trigger functions here are security definer: a guard must see every row whoever writes, and may
-- call private helpers that members cannot.

-- An order's documents are locked while its bill is issued and no revision is open.
create function private.order_is_locked(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.bills where order_id = p_order_id and state = 'issued')
    and not exists (select 1 from public.bills where order_id = p_order_id and state = 'draft')
$$;

create function private.raise_order_locked(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'order_locked'
    using errcode = 'AMH01',
      detail = format('Order %s has an issued bill.', (select number from public.orders where id = p_order_id)),
      hint = 'Revise the bill to change the order.';
end;
$$;

-- Order lines, challan quantities and the summary: no change at all while the order is locked.
create function private.guard_locked_order_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and private.order_is_locked(old.order_id) then
    perform private.raise_order_locked(old.order_id);
  end if;
  if tg_op <> 'DELETE' and private.order_is_locked(new.order_id) then
    perform private.raise_order_locked(new.order_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Challans: while the order is locked, only delivery and signed-copy tracking may change.
create function private.guard_locked_challan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_tracking constant text[] := array['delivered_at', 'delivered_via', 'signed_returned', 'signed_photo_path', 'updated_at'];
begin
  if tg_op = 'UPDATE' and new.order_id = old.order_id and private.order_is_locked(old.order_id) then
    if (to_jsonb(new) - c_tracking) is distinct from (to_jsonb(old) - c_tracking) then
      perform private.raise_order_locked(old.order_id);
    end if;
    return new;
  end if;
  if tg_op <> 'INSERT' and private.order_is_locked(old.order_id) then
    perform private.raise_order_locked(old.order_id);
  end if;
  if tg_op <> 'DELETE' and private.order_is_locked(new.order_id) then
    perform private.raise_order_locked(new.order_id);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Orders: numbering, status and the bill that comes with every order
-- ---------------------------------------------------------------------------------------------

create function private.prepare_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.business_settings;
begin
  select * into strict v_settings from public.business_settings;
  new.fiscal_year := private.fiscal_year_of(private.dhaka_today(), v_settings.fiscal_year_start_month);
  new.seq := private.next_number('order', new.fiscal_year);
  new.number := private.format_order_number(v_settings.number_prefix, new.fiscal_year, new.seq);
  if new.status not in ('draft', 'confirmed') and coalesce(current_setting('amh.system_change', true), '') <> 'on' then
    raise exception 'status_change_not_allowed'
      using errcode = 'AMH03', detail = format('A new order starts as draft or confirmed, not %s.', new.status);
  end if;
  return new;
end;
$$;

create trigger t10_prepare_order
  before insert on public.orders
  for each row execute function private.prepare_order();

create function private.guard_order_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.fiscal_year, new.seq, new.number) is distinct from (old.fiscal_year, old.seq, old.number) then
    raise exception 'number_immutable'
      using errcode = 'AMH02', detail = format('Order %s keeps its number.', old.number);
  end if;
  if (new.project_id, new.entry_mode) is distinct from (old.project_id, old.entry_mode)
    and private.order_is_locked(old.id) then
    perform private.raise_order_locked(old.id);
  end if;
  if new.status is distinct from old.status and not private.status_change_allowed(old.status, new.status) then
    raise exception 'status_change_not_allowed'
      using errcode = 'AMH03', detail = format('Order %s cannot go from %s to %s by hand.', old.number, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger t10_guard_order_update
  before update on public.orders
  for each row execute function private.guard_order_update();

create function private.create_order_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.bills (order_id, buyer_text, address_text)
  select new.id, p.billing_buyer_name, p.billing_address
  from public.projects as p
  where p.id = new.project_id;
  return null;
end;
$$;

-- After the audit trigger (t90), so the log shows the order before its bill.
create trigger t95_create_order_bill
  after insert on public.orders
  for each row execute function private.create_order_bill();

-- ---------------------------------------------------------------------------------------------
-- Lines: the package snapshot
-- ---------------------------------------------------------------------------------------------

-- Copies the package's name, items and rate into the line (unless given) and puts it last.
create function private.prepare_order_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.packages;
begin
  if new.package_id is not null and (new.name is null or new.items is null or new.rate is null) then
    select * into v_package from public.packages where id = new.package_id;
    new.name := coalesce(new.name, v_package.name);
    new.items := coalesce(new.items, v_package.items);
    new.rate := coalesce(new.rate, v_package.rate);
  end if;
  if new.position is null then
    select coalesce(max(position), 0) + 1 into new.position from public.order_lines where order_id = new.order_id;
  end if;
  return new;
end;
$$;

create trigger t10_guard_lock
  before insert or update or delete on public.order_lines
  for each row execute function private.guard_locked_order_row();

create trigger t20_prepare_order_line
  before insert on public.order_lines
  for each row execute function private.prepare_order_line();

-- ---------------------------------------------------------------------------------------------
-- Challans and their quantities
-- ---------------------------------------------------------------------------------------------

-- Numbers the challan within its order and fills the printed header from the structured fields:
-- the client's billing name, the place, the log code.
create function private.prepare_challan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.number := private.next_number('challan', new.order_id::text);
  if new.buyer_text = '' then
    select coalesce(p.billing_buyer_name, '') into new.buyer_text
    from public.orders as o join public.projects as p on p.id = o.project_id
    where o.id = new.order_id;
  end if;
  if new.address_text = '' and new.location_id is not null then
    select coalesce(name_en, '') into new.address_text from public.locations where id = new.location_id;
  end if;
  if new.log_code_text = '' and new.log_code_id is not null then
    select coalesce(code, '') into new.log_code_text from public.log_codes where id = new.log_code_id;
  end if;
  new.buyer_text := coalesce(new.buyer_text, '');
  new.address_text := coalesce(new.address_text, '');
  new.log_code_text := coalesce(new.log_code_text, '');
  return new;
end;
$$;

create function private.guard_challan_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is distinct from old.number or new.order_id is distinct from old.order_id then
    raise exception 'number_immutable'
      using errcode = 'AMH02', detail = 'A challan keeps its order and number.';
  end if;
  return new;
end;
$$;

create trigger t10_guard_lock
  before insert or update or delete on public.challans
  for each row execute function private.guard_locked_challan();

create trigger t15_guard_challan_number
  before update on public.challans
  for each row execute function private.guard_challan_number();

create trigger t20_prepare_challan
  before insert on public.challans
  for each row execute function private.prepare_challan();

create function private.prepare_challan_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select order_id into new.order_id from public.challans where id = new.challan_id;
  return new;
end;
$$;

-- order_id comes from the challan before the lock is checked.
create trigger t05_prepare_challan_line
  before insert or update of challan_id on public.challan_lines
  for each row execute function private.prepare_challan_line();

create trigger t10_guard_lock
  before insert or update or delete on public.challan_lines
  for each row execute function private.guard_locked_order_row();

create trigger t10_guard_lock
  before insert or update or delete on public.summaries
  for each row execute function private.guard_locked_order_row();

-- ---------------------------------------------------------------------------------------------
-- Bills and issued documents
-- ---------------------------------------------------------------------------------------------

-- A draft can only be issued; an issued bill can only be superseded by its revision or voided;
-- nothing else about a bill changes once it is issued, and it is never deleted.
create function private.guard_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_closing constant text[] := array['state', 'closed_at', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.state <> 'draft' then
      raise exception 'bill_locked'
        using errcode = 'AMH01', detail = format('Bill %s stays in history.', old.number),
          hint = 'Void or revise the bill instead.';
    end if;
    return old;
  end if;

  if (new.order_id, new.revision, new.supersedes_bill_id) is distinct from (old.order_id, old.revision, old.supersedes_bill_id) then
    raise exception 'number_immutable'
      using errcode = 'AMH02', detail = 'A bill keeps its order, revision and predecessor.';
  end if;

  if old.state = 'draft' then
    if new.state not in ('draft', 'issued') then
      raise exception 'bill_locked'
        using errcode = 'AMH01', detail = format('A draft bill can be issued, not marked %s.', new.state);
    end if;
    return new;
  end if;

  if not (
    old.state = 'issued'
    and new.state in ('superseded', 'void')
    and (to_jsonb(new) - c_closing) = (to_jsonb(old) - c_closing)
  ) then
    raise exception 'bill_locked'
      using errcode = 'AMH01', detail = format('Bill %s is %s and cannot change.', old.number, old.state),
        hint = 'Revise the bill to change it.';
  end if;
  return new;
end;
$$;

create trigger t10_guard_bill
  before update or delete on public.bills
  for each row execute function private.guard_bill();

-- The number a bill gets when it is issued on p_issue_date: the next in the issue date's fiscal
-- year for an original, the original's number with -Rn for revision n. Called by the issue step
-- (Segment 5) inside its transaction.
create function private.bill_number_for(p_bill_id uuid, p_issue_date date)
returns table (fiscal_year text, seq integer, number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.bills;
  v_settings public.business_settings;
  v_fiscal_year text;
  v_seq integer;
begin
  select * into strict v_bill from public.bills as b where b.id = p_bill_id;
  select * into strict v_settings from public.business_settings;
  if v_bill.revision = 0 then
    v_fiscal_year := private.fiscal_year_of(p_issue_date, v_settings.fiscal_year_start_month);
    v_seq := private.next_number('bill', v_fiscal_year);
  else
    select b.fiscal_year, b.seq into strict v_fiscal_year, v_seq
    from public.bills as b
    where b.order_id = v_bill.order_id and b.revision = 0;
  end if;
  return query select
    v_fiscal_year,
    v_seq,
    private.format_bill_number(v_settings.number_prefix, v_fiscal_year, v_seq, v_bill.revision);
end;
$$;

create function private.guard_issued_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.bills where id = new.bill_id and state = 'issued') then
      raise exception 'bill_not_issued'
        using errcode = 'AMH01', detail = 'Documents are stored when their bill is issued.';
    end if;
    return new;
  end if;
  raise exception 'issued_document_immutable'
    using errcode = 'AMH01', detail = 'Issued documents are never changed or removed.';
end;
$$;

create trigger t10_guard_issued_document
  before insert or update or delete on public.issued_documents
  for each row execute function private.guard_issued_document();

-- ---------------------------------------------------------------------------------------------
-- Access: members only. Numbers, frozen bill fields and bill states are written by triggers and
-- server functions, so members get column-level grants without them.
-- ---------------------------------------------------------------------------------------------

select private.grant_member_access('public.orders', 'select, delete');
grant insert (
  id, project_id, title, po_number, internal_ref, source, entry_mode, status, date_from, date_to, notes
) on table public.orders to authenticated;
grant update (
  project_id, title, po_number, internal_ref, source, entry_mode, status, date_from, date_to, notes
) on table public.orders to authenticated;

select private.grant_member_access('public.order_lines', 'select, delete');
grant insert (id, order_id, package_id, name, items, rate, position, bill_qty)
  on table public.order_lines to authenticated;
grant update (package_id, name, items, rate, position, bill_qty)
  on table public.order_lines to authenticated;

select private.grant_member_access('public.challans', 'select, delete');
grant insert (
  id, order_id, delivery_date, delivery_time, location_id, log_code_id, contact_id,
  buyer_text, address_text, log_code_text, position,
  delivered_at, delivered_via, signed_returned, signed_photo_path
) on table public.challans to authenticated;
grant update (
  delivery_date, delivery_time, location_id, log_code_id, contact_id,
  buyer_text, address_text, log_code_text, position,
  delivered_at, delivered_via, signed_returned, signed_photo_path
) on table public.challans to authenticated;

-- Quantities are often upserted; the conflict columns are therefore updatable too.
select private.grant_member_access('public.challan_lines', 'select, delete');
grant insert (id, challan_id, order_line_id, qty, qty_input) on table public.challan_lines to authenticated;
grant update (challan_id, order_line_id, qty, qty_input) on table public.challan_lines to authenticated;

select private.grant_member_access('public.summaries', 'select, delete');
grant insert (order_id, buyer_text, address_text, log_code_text, summary_date)
  on table public.summaries to authenticated;
grant update (buyer_text, address_text, log_code_text, summary_date)
  on table public.summaries to authenticated;

select private.grant_member_access('public.order_files', 'select, delete');
grant insert (id, order_id, challan_id, kind, storage_path, filename, mime_type, byte_size, sha256)
  on table public.order_files to authenticated;
grant update (challan_id, kind, filename) on table public.order_files to authenticated;

select private.grant_member_access('public.bills', 'select');
grant update (buyer_text, address_text, bill_date, serial_text) on table public.bills to authenticated;

select private.grant_member_access('public.issued_documents', 'select');

select private.grant_member_access('public.import_profiles');

select private.grant_member_access('public.delivery_links', 'select, delete');
grant insert (id, order_id, token_hash, delivery_date, area_id, expires_at)
  on table public.delivery_links to authenticated;
grant update (expires_at, revoked_at) on table public.delivery_links to authenticated;

select private.track_updates('public.orders');
select private.track_updates('public.order_lines');
select private.track_updates('public.challans');
select private.track_updates('public.challan_lines');
select private.track_updates('public.summaries');
select private.track_updates('public.order_files');
select private.track_updates('public.bills');
select private.track_updates('public.import_profiles');
select private.track_updates('public.delivery_links');
