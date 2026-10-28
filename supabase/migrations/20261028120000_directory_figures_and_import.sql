-- Directory screens (BLUEPRINT §5.7): the figures shown on client and location cards, and the
-- package list import, which checks a list against the directory before anything is written.
--
-- Errors: AMH05 package_list_invalid (the list itself is malformed; the app checks files before
-- sending them, so members should never see it).

-- The figures below run with the member's rights and compare dates with the current fiscal year.
grant execute on function private.fiscal_year_of(date, integer) to authenticated, service_role;
grant execute on function private.current_fiscal_year() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Figures
-- ---------------------------------------------------------------------------------------------

-- Per project (client): what was billed this fiscal year, what is still unpaid, and how long the
-- client takes to pay. Days to pay run from an order's first issued bill to the payment that
-- settled it, so a revision issued later does not make a client look quicker than it was.
create view public.project_figures
with (security_invoker = true)
as
select
  p.id as project_id,
  coalesce(billed.gross, 0)::numeric(12, 2) as billed_this_fy,
  coalesce(billed.bill_count, 0)::integer as bills_this_fy,
  coalesce(unpaid.outstanding, 0)::numeric(12, 2) as unpaid,
  coalesce(unpaid.expected_still, 0)::numeric(12, 2) as unpaid_expected_net,
  coalesce(unpaid.bill_count, 0)::integer as unpaid_bills,
  unpaid.oldest_days as oldest_unpaid_days,
  paid.avg_days::integer as avg_days_to_pay,
  coalesce(paid.order_count, 0)::integer as paid_orders,
  -- What reaches the bank from a ৳100 bill at this client's deduction rate.
  private.expected_net_of(100, p.deduction_rate)::numeric(12, 2) as net_per_100
from public.projects as p
cross join (select fiscal_year_start_month as start_month from public.business_settings) as s
left join lateral (
  select sum(b.gross) as gross, count(*) as bill_count
  from public.bills as b
  join public.orders as o on o.id = b.order_id
  where o.project_id = p.id
    and b.state = 'issued'
    and private.fiscal_year_of((b.issued_at at time zone 'Asia/Dhaka')::date, s.start_month)
      = private.current_fiscal_year()
) as billed on true
left join lateral (
  select
    sum(bb.outstanding) as outstanding,
    sum(bb.expected_still) as expected_still,
    count(*) as bill_count,
    max(bb.days_outstanding) as oldest_days
  from public.bill_balances as bb
  join public.orders as o on o.id = bb.order_id
  where o.project_id = p.id and bb.outstanding > 0
) as unpaid on true
left join lateral (
  select round(avg(settled.days)) as avg_days, count(*) as order_count
  from (
    select greatest(
      (
        select max(py.received_on)
        from public.payment_allocations as a
        join public.bills as fb on fb.id = a.bill_id
        join public.payments as py on py.id = a.payment_id
        where fb.order_id = bb.order_id
      ) - (
        select min((fb.issued_at at time zone 'Asia/Dhaka')::date)
        from public.bills as fb
        where fb.order_id = bb.order_id and fb.issued_at is not null
      ),
      0
    ) as days
    from public.bill_balances as bb
    join public.orders as o on o.id = bb.order_id
    where o.project_id = p.id and bb.outstanding <= 0
  ) as settled
) as paid on true;

comment on view public.project_figures is
  'Per client project: billed this fiscal year, unpaid (gross and expected net), average days to pay.';

-- Per location: how often it is delivered to. Cancelled orders do not count.
create view public.location_figures
with (security_invoker = true)
as
select
  l.id as location_id,
  (count(c.id) filter (
    where private.fiscal_year_of(c.delivery_date, s.start_month) = private.current_fiscal_year()
  ))::integer as deliveries_this_fy,
  count(c.id)::integer as deliveries_total,
  max(c.delivery_date) as last_delivery_on
from public.locations as l
cross join (select fiscal_year_start_month as start_month from public.business_settings) as s
left join public.challans as c
  on c.location_id = l.id
  and exists (select 1 from public.orders as o where o.id = c.order_id and o.status <> 'cancelled')
group by l.id, s.start_month;

comment on view public.location_figures is 'Per location: deliveries this fiscal year, in all, and the last one.';

grant select on public.project_figures, public.location_figures to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Package list import
-- ---------------------------------------------------------------------------------------------

create function private.raise_package_list_invalid(p_detail text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'package_list_invalid' using errcode = 'AMH05', detail = p_detail;
end;
$$;

grant execute on function private.raise_package_list_invalid(text) to authenticated, service_role;

-- Compares a package list with the directory and, when p_apply is true, makes the directory match
-- it in one transaction whose changes share one audit batch. The app calls it twice: first to show
-- the member what would change, then, after they confirm, to apply it (BLUEPRINT §2.6).
--
-- p_list: {"categories": [{"name_en", "name_bn"?}],
--          "packages": [{"name", "category", "rate": "18.00", "items"?: [{"en", "bn"?}], "notes"?}]}
-- Names match by name key, so spacing and case do not create duplicates. A package's items and
-- notes change only when the list has them. A switched-off package in the list is switched on.
-- Packages missing from the list are left as they are and reported.
--
-- Returns {"applied", "batch_id", "categories": [{"name_en", "outcome", "changes"}],
--          "packages": [{"name", "category", "outcome", "changes", "old_rate", "rate"}],
--          "not_in_list": [{"id", "name", "rate"}]}
-- where outcome is new, changed or unchanged, and rates are exact decimal strings.
create function public.import_package_list(p_list jsonb, p_apply boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_entry jsonb;
  v_position integer := 0;
  v_key text;
  v_category_keys text[] := '{}'::text[];
  v_package_keys text[] := '{}'::text[];
  v_category public.package_categories;
  v_package public.packages;
  v_category_id uuid;
  v_name text;
  v_name_bn text;
  v_rate numeric(10, 2);
  v_items jsonb;
  v_notes text;
  v_changes text[];
  v_categories jsonb := '[]'::jsonb;
  v_packages jsonb := '[]'::jsonb;
  v_not_in_list jsonb;
begin
  if jsonb_typeof(p_list -> 'categories') is distinct from 'array'
    or jsonb_typeof(p_list -> 'packages') is distinct from 'array' then
    perform private.raise_package_list_invalid('The list needs a categories array and a packages array.');
  end if;

  if p_apply then
    -- Inside a larger action (the assistant), keep its batch so it is undone as one.
    v_batch_id := coalesce(nullif(current_setting('amh.batch_id', true), '')::uuid, gen_random_uuid());
    perform set_config('amh.batch_id', v_batch_id::text, true);
  end if;

  -- Categories, in the list's order, which becomes their display order.
  for v_entry in select value from jsonb_array_elements(p_list -> 'categories') loop
    v_position := v_position + 1;
    v_name := btrim(coalesce(v_entry ->> 'name_en', ''));
    v_key := private.name_key(v_name);
    if v_key is null then
      perform private.raise_package_list_invalid(format('Category %s has no English name.', v_position));
    end if;
    if v_key = any (v_category_keys) then
      perform private.raise_package_list_invalid(format('Category "%s" is listed twice.', v_name));
    end if;
    v_category_keys := v_category_keys || v_key;
    v_name_bn := btrim(coalesce(v_entry ->> 'name_bn', ''));

    select * into v_category from public.package_categories where private.name_key(name_en) = v_key;
    if not found then
      v_changes := null;
      if p_apply then
        insert into public.package_categories (name_en, name_bn, sort_order)
        values (v_name, v_name_bn, v_position);
      end if;
    else
      v_changes := array_remove(array[
        case when v_category.name_en <> v_name then 'name' end,
        case when v_entry ? 'name_bn' and v_category.name_bn <> v_name_bn then 'name_bn' end,
        case when v_category.sort_order <> v_position then 'order' end
      ], null);
      if p_apply and cardinality(v_changes) > 0 then
        update public.package_categories
        set name_en = v_name,
            name_bn = case when v_entry ? 'name_bn' then v_name_bn else name_bn end,
            sort_order = v_position
        where id = v_category.id;
      end if;
    end if;

    v_categories := v_categories || jsonb_build_object(
      'name_en', v_name,
      'outcome', case when v_changes is null then 'new' when cardinality(v_changes) > 0 then 'changed' else 'unchanged' end,
      'changes', to_jsonb(coalesce(v_changes, '{}'))
    );
  end loop;

  -- Packages.
  v_position := 0;
  for v_entry in select value from jsonb_array_elements(p_list -> 'packages') loop
    v_position := v_position + 1;
    v_name := btrim(coalesce(v_entry ->> 'name', ''));
    v_key := private.name_key(v_name);
    if v_key is null then
      perform private.raise_package_list_invalid(format('Package %s has no name.', v_position));
    end if;
    if v_key = any (v_package_keys) then
      perform private.raise_package_list_invalid(format('Package "%s" is listed twice.', v_name));
    end if;
    v_package_keys := v_package_keys || v_key;

    if coalesce(v_entry ->> 'rate', '') !~ '^\d{1,8}(\.\d{1,2})?$' then
      perform private.raise_package_list_invalid(format('Package "%s" has no valid rate.', v_name));
    end if;
    v_rate := (v_entry ->> 'rate')::numeric(10, 2);

    if v_entry ? 'items' and not private.is_item_list(v_entry -> 'items') then
      perform private.raise_package_list_invalid(format('The items of package "%s" are not a list of lines.', v_name));
    end if;

    if not coalesce(private.name_key(v_entry ->> 'category') = any (v_category_keys), false) then
      perform private.raise_package_list_invalid(format('Package "%s" names a category the list does not have.', v_name));
    end if;
    -- Null in a dry run when the category is new.
    select id into v_category_id from public.package_categories
    where private.name_key(name_en) = private.name_key(v_entry ->> 'category');

    v_notes := btrim(coalesce(v_entry ->> 'notes', ''));

    select * into v_package from public.packages where private.name_key(name) = v_key;
    if not found then
      v_changes := null;
      if p_apply then
        insert into public.packages (name, category_id, rate, items, notes)
        values (v_name, v_category_id, v_rate, coalesce(v_entry -> 'items', '[]'), v_notes);
      end if;
    else
      v_items := case when v_entry ? 'items' then v_entry -> 'items' else v_package.items end;
      v_changes := array_remove(array[
        case when v_package.name <> v_name then 'name' end,
        case when v_package.category_id is distinct from v_category_id then 'category' end,
        case when v_package.rate <> v_rate then 'rate' end,
        case when v_package.items <> v_items then 'items' end,
        case when v_entry ? 'notes' and v_package.notes <> v_notes then 'notes' end,
        case when not v_package.active then 'active' end
      ], null);
      if p_apply and cardinality(v_changes) > 0 then
        update public.packages
        set name = v_name,
            category_id = v_category_id,
            rate = v_rate,
            items = v_items,
            notes = case when v_entry ? 'notes' then v_notes else notes end,
            active = true
        where id = v_package.id;
      end if;
    end if;

    v_packages := v_packages || jsonb_build_object(
      'name', v_name,
      'category', btrim(v_entry ->> 'category'),
      'outcome', case when v_changes is null then 'new' when cardinality(v_changes) > 0 then 'changed' else 'unchanged' end,
      'changes', to_jsonb(coalesce(v_changes, '{}')),
      'old_rate', case when v_changes is not null then v_package.rate::text end,
      'rate', v_rate::text
    );
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'rate', rate::text) order by rate, name), '[]')
  into v_not_in_list
  from public.packages
  where active and not private.name_key(name) = any (v_package_keys);

  return jsonb_build_object(
    'applied', p_apply,
    'batch_id', v_batch_id,
    'categories', v_categories,
    'packages', v_packages,
    'not_in_list', v_not_in_list
  );
end;
$$;

comment on function public.import_package_list(jsonb, boolean) is
  'Checks a package list against the directory (p_apply false) or applies it in one audit batch.';

grant execute on function public.import_package_list(jsonb, boolean) to authenticated, service_role;
