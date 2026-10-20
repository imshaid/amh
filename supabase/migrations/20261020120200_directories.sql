-- Directories (BLUEPRINT §4, §5.7): clients and their projects, log codes, areas and locations with
-- learned aliases, contacts, and packages with rate history and client-side codes.
-- Directory rows are switched off with `active`, not deleted, once anything refers to them.

create type public.alias_source as enum ('import', 'manual');

-- ---------------------------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name_en text not null constraint organisations_name_en_present check (btrim(name_en) <> ''),
  name_bn text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organisations_name_key on public.organisations (private.name_key(name_en));

comment on table public.organisations is 'A client organisation, e.g. World Vision Bangladesh.';

-- The billed unit: World Vision bills Thakurgaon AP and REACTS-IN Project separately.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  name_en text not null constraint projects_name_en_present check (btrim(name_en) <> ''),
  name_bn text not null default '',
  -- Printed as ক্রেতার নাম and ঠিকানা on new documents; each document keeps its own copy.
  billing_buyer_name text not null constraint projects_billing_buyer_name_present check (btrim(billing_buyer_name) <> ''),
  billing_address text not null default '',
  -- Tax deducted at source when the client pays: 0.1600 means a ৳100 bill arrives as ৳84.
  deduction_rate numeric(5, 4) not null default 0.1600
    constraint projects_deduction_rate_range check (deduction_rate >= 0 and deduction_rate < 1),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_name_key on public.projects (organisation_id, private.name_key(name_en));

comment on table public.projects is 'A billed client unit of an organisation, with its billing name, address and deduction rate.';

create table public.log_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  -- e.g. 132.01.08
  code text not null constraint log_codes_code_format check (code ~ '^\S+$'),
  activity_en text not null default '',
  activity_bn text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint log_codes_project_code_key unique (project_id, code)
);

comment on table public.log_codes is 'A client''s activity code, printed in the Log Code field of challans and summaries.';

-- ---------------------------------------------------------------------------------------------
-- Places and people
-- ---------------------------------------------------------------------------------------------

-- A union or route: datasheets and delivery links can be split by area.
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name_en text not null constraint areas_name_en_present check (btrim(name_en) <> ''),
  name_bn text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index areas_name_key on public.areas (private.name_key(name_en));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  -- As clients write it; the Bangla name is for datasheets.
  name_en text not null constraint locations_name_en_present check (btrim(name_en) <> ''),
  name_bn text not null default '',
  area_id uuid references public.areas (id) on delete set null,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Not unique: two unions can have places with the same name.
create index locations_name_key_idx on public.locations (private.name_key(name_en));
create index locations_area_id_idx on public.locations (area_id);

-- Spelling variants seen in imports: Darapra -> Darapara LR. An alias points at one place only.
create table public.location_aliases (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations (id) on delete cascade,
  alias text not null constraint location_aliases_alias_present check (btrim(alias) <> ''),
  source public.alias_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index location_aliases_alias_key on public.location_aliases (private.name_key(alias));
create index location_aliases_location_id_idx on public.location_aliases (location_id);

-- Facilitators who receive deliveries.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name_en text not null default '',
  name_bn text not null default '',
  phone text constraint contacts_phone_normalised check (phone ~ '^01[3-9][0-9]{8}$'),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_named check (btrim(name_en) <> '' or btrim(name_bn) <> '')
);

create index contacts_phone_idx on public.contacts (phone);

-- Who usually receives at a place, optionally for one project only.
create table public.contact_locations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_locations_key unique nulls not distinct (contact_id, location_id, project_id)
);

create index contact_locations_location_id_idx on public.contact_locations (location_id);
create index contact_locations_project_id_idx on public.contact_locations (project_id);

-- ---------------------------------------------------------------------------------------------
-- Packages
-- ---------------------------------------------------------------------------------------------

create table public.package_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null constraint package_categories_name_en_present check (btrim(name_en) <> ''),
  name_bn text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index package_categories_name_key on public.package_categories (private.name_key(name_en));

-- Item lines, in order: [{"en": "Chinigura Rice (Polao) — 300 g ±", "bn": "..."}]. English is
-- printed on documents; Bangla is shown in the app only.
create function private.is_item_list(items jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(items) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(items) as item
      where jsonb_typeof(item) <> 'object'
        or jsonb_typeof(item -> 'en') is distinct from 'string'
        or btrim(item ->> 'en') = ''
        or (item ? 'bn' and jsonb_typeof(item -> 'bn') <> 'string')
        or exists (select 1 from jsonb_object_keys(item) as key where key not in ('en', 'bn'))
    )
$$;

grant execute on function private.is_item_list(jsonb) to authenticated, service_role;

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  -- The WV code (Lunch Basic-07): POs use these names and bills are matched against POs.
  name text not null constraint packages_name_present check (btrim(name) <> ''),
  category_id uuid not null references public.package_categories (id) on delete restrict,
  -- The current rate. Packages are known by price; several may share one (৳20, 30, 35, 36, 60).
  rate numeric(10, 2) not null constraint packages_rate_not_negative check (rate >= 0),
  items jsonb not null default '[]' constraint packages_items_shape check (private.is_item_list(items)),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index packages_name_key on public.packages (private.name_key(name));
create index packages_rate_idx on public.packages (rate) where active;
create index packages_category_id_idx on public.packages (category_id);

comment on table public.packages is
  'Food packages. Orders copy name, items and rate when a line is added, so later edits here never change an order.';

-- Rate history, written by a trigger whenever a package's rate is set. Append-only.
create table public.package_rates (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  rate numeric(10, 2) not null constraint package_rates_rate_not_negative check (rate >= 0),
  effective_from date not null default private.dhaka_today(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index package_rates_package_id_idx on public.package_rates (package_id, created_at desc);
create index package_rates_created_by_idx on public.package_rates (created_by);

create function private.record_package_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.rate is distinct from old.rate then
    insert into public.package_rates (package_id, rate) values (new.id, new.rate);
  end if;
  return null;
end;
$$;

create trigger t30_record_package_rate
  after insert or update of rate on public.packages
  for each row execute function private.record_package_rate();

-- Other names a client uses for a package on its POs (ADORSHA_HOTEL_PACKAGE_14_SNACKS_BASIC_3).
create table public.package_client_codes (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  code text not null constraint package_client_codes_code_present check (btrim(code) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_client_codes_key unique (organisation_id, code)
);

create index package_client_codes_package_id_idx on public.package_client_codes (package_id);

-- ---------------------------------------------------------------------------------------------
-- Access and bookkeeping
-- ---------------------------------------------------------------------------------------------

select private.grant_member_access('public.organisations');
select private.grant_member_access('public.projects');
select private.grant_member_access('public.log_codes');
select private.grant_member_access('public.areas');
select private.grant_member_access('public.locations');
select private.grant_member_access('public.location_aliases');
select private.grant_member_access('public.contacts');
select private.grant_member_access('public.contact_locations');
select private.grant_member_access('public.package_categories');
select private.grant_member_access('public.packages');
select private.grant_member_access('public.package_client_codes');
-- History is written by the trigger only.
select private.grant_member_access('public.package_rates', 'select');

select private.track_updates('public.organisations');
select private.track_updates('public.projects');
select private.track_updates('public.log_codes');
select private.track_updates('public.areas');
select private.track_updates('public.locations');
select private.track_updates('public.location_aliases');
select private.track_updates('public.contacts');
select private.track_updates('public.contact_locations');
select private.track_updates('public.package_categories');
select private.track_updates('public.packages');
select private.track_updates('public.package_client_codes');
