-- Money (BLUEPRINT §2.7, §4, §5.5): payments and the bills they settle, and every figure the app
-- shows about money, computed here with exact decimals. The UI and the AI only format these values.
--
--   line amount   = bill quantity × the line's rate, where the bill quantity is the typed one or
--                   else the sum of the challans
--   gross         = the sum of an order's line amounts
--   deduction     = round(gross × the client's deduction rate, 2)   (tax deducted at source)
--   expected net  = gross − deduction                                (what should reach the bank)
--
-- A bill freezes these at issue. A payment is what reached the bank; its allocations say which
-- bills it settles, each with the tax the client deducted. Payments recorded against a bill count
-- for its later revisions too, because they settle the same order.
--
-- Errors: AMH01 bill_not_issued, AMH04 payment_over_allocated / bill_over_settled.

create type public.payment_method as enum ('bank_eft', 'cash', 'other');

-- ---------------------------------------------------------------------------------------------
-- The formulas
-- ---------------------------------------------------------------------------------------------

create function private.deduction_of(p_gross numeric, p_rate numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select round(p_gross * p_rate, 2)
$$;

create function private.expected_net_of(p_gross numeric, p_rate numeric)
returns numeric
language sql
immutable
strict
set search_path = ''
as $$
  select p_gross - round(p_gross * p_rate, 2)
$$;

grant execute on function private.deduction_of(numeric, numeric) to authenticated, service_role;
grant execute on function private.expected_net_of(numeric, numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  -- What reached the bank: the bills' gross less the tax the client deducted.
  amount numeric(12, 2) not null constraint payments_amount_positive check (amount > 0),
  method public.payment_method not null default 'bank_eft',
  -- The bank SMS carries the PO number without its hyphen (PBD2778470).
  bank_reference text,
  bank_reference_key text generated always as (private.reference_key(bank_reference)) stored,
  raw_sms text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);

create index payments_received_on_idx on public.payments (received_on desc);
create index payments_bank_reference_key_idx on public.payments (bank_reference_key) where bank_reference_key is not null;
create index payments_created_by_idx on public.payments (created_by);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete restrict,
  -- The part of the payment that settles this bill, and the tax the client deducted from it.
  received_amount numeric(12, 2) not null constraint payment_allocations_received_not_negative check (received_amount >= 0),
  deduction_amount numeric(12, 2) not null default 0 constraint payment_allocations_deduction_not_negative check (deduction_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_allocations_key unique (payment_id, bill_id),
  constraint payment_allocations_not_empty check (received_amount + deduction_amount > 0)
);

create index payment_allocations_bill_id_idx on public.payment_allocations (bill_id);

-- Payments settle issued bills only.
create function private.guard_allocation_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.bill_id is distinct from old.bill_id)
    and not exists (select 1 from public.bills where id = new.bill_id and state = 'issued') then
    raise exception 'bill_not_issued'
      using errcode = 'AMH01', detail = 'Payments are recorded against issued bills.';
  end if;
  return new;
end;
$$;

create trigger t10_guard_allocation_bill
  before insert or update on public.payment_allocations
  for each row execute function private.guard_allocation_bill();

-- What has settled an order so far: received plus deducted, over all its bills' revisions.
create function private.order_settled(p_order_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(a.received_amount + a.deduction_amount), 0)
  from public.payment_allocations as a
  join public.bills as b on b.id = a.bill_id
  where b.order_id = p_order_id
$$;

-- No payment is spread wider than its amount, and no order is settled beyond its issued gross.
-- Checked at commit, so a payment can be re-split in several steps.
create function private.check_allocation_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_amount numeric;
  v_allocated numeric;
  v_order_id uuid;
  v_gross numeric;
  v_settled numeric;
begin
  select amount into v_payment_amount from public.payments where id = new.payment_id;
  select coalesce(sum(received_amount), 0) into v_allocated
  from public.payment_allocations where payment_id = new.payment_id;
  if v_allocated > v_payment_amount then
    raise exception 'payment_over_allocated'
      using errcode = 'AMH04', detail = format('%s of a %s payment is allocated.', v_allocated, v_payment_amount);
  end if;

  select order_id into v_order_id from public.bills where id = new.bill_id;
  select gross into v_gross from public.bills where order_id = v_order_id and state = 'issued';
  v_settled := private.order_settled(v_order_id);
  if v_gross is not null and v_settled > v_gross then
    raise exception 'bill_over_settled'
      using errcode = 'AMH04', detail = format('%s settled against a bill of %s.', v_settled, v_gross);
  end if;
  return null;
end;
$$;

create constraint trigger t50_check_allocation_totals
  after insert or update on public.payment_allocations
  deferrable initially deferred
  for each row execute function private.check_allocation_totals();

create function private.check_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocated numeric;
begin
  select coalesce(sum(received_amount), 0) into v_allocated
  from public.payment_allocations where payment_id = new.id;
  if v_allocated > new.amount then
    raise exception 'payment_over_allocated'
      using errcode = 'AMH04', detail = format('%s of a %s payment is allocated.', v_allocated, new.amount);
  end if;
  return null;
end;
$$;

create constraint trigger t50_check_payment_amount
  after update of amount on public.payments
  deferrable initially deferred
  for each row execute function private.check_payment_amount();

-- A billed order becomes partially paid with its first allocation and paid when it is settled in
-- full; removing allocations moves it back.
create function private.refresh_payment_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
  v_gross numeric;
  v_settled numeric;
  v_next public.order_status;
  v_previous text;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null or v_status not in ('billed', 'partially_paid', 'paid') then
    return;
  end if;
  select gross into v_gross from public.bills where order_id = p_order_id and state = 'issued';
  if v_gross is null then
    return;
  end if;
  v_settled := private.order_settled(p_order_id);
  v_next := case
    when v_settled >= v_gross then 'paid'::public.order_status
    when v_settled > 0 then 'partially_paid'::public.order_status
    else 'billed'::public.order_status
  end;
  if v_next <> v_status then
    v_previous := current_setting('amh.system_change', true);
    perform set_config('amh.system_change', 'on', true);
    update public.orders set status = v_next where id = p_order_id;
    perform set_config('amh.system_change', coalesce(v_previous, ''), true);
  end if;
end;
$$;

create function private.sync_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    perform private.refresh_payment_status((select order_id from public.bills where id = old.bill_id));
  end if;
  if tg_op <> 'DELETE' then
    perform private.refresh_payment_status((select order_id from public.bills where id = new.bill_id));
  end if;
  return null;
end;
$$;

create trigger t60_sync_payment_status
  after insert or update or delete on public.payment_allocations
  for each row execute function private.sync_payment_status();

-- ---------------------------------------------------------------------------------------------
-- Figures (views run with the caller's rights, so RLS applies)
-- ---------------------------------------------------------------------------------------------

-- Per order line: quantities from the challans, the bill quantity, and the amount.
create view public.order_line_totals
with (security_invoker = true)
as
select
  l.id as order_line_id,
  l.order_id,
  l.position,
  l.rate,
  coalesce(q.challan_qty, 0)::integer as challan_qty,
  coalesce(l.bill_qty, q.challan_qty, 0)::integer as bill_qty,
  l.bill_qty is not null as bill_qty_typed,
  -- A typed bill quantity that disagrees with the challans: shown, never hidden.
  (l.bill_qty is not null and l.bill_qty <> coalesce(q.challan_qty, 0)) as qty_differs,
  (coalesce(l.bill_qty, q.challan_qty, 0) * l.rate)::numeric(12, 2) as amount
from public.order_lines as l
left join lateral (
  select sum(c.qty) as challan_qty from public.challan_lines as c where c.order_line_id = l.id
) as q on true;

-- Per order: gross, the deduction rate that applies, deduction and expected net. A locked order
-- uses its issued bill's frozen rate; otherwise the client's current rate.
create view public.order_totals
with (security_invoker = true)
as
select
  o.id as order_id,
  coalesce(t.gross, 0)::numeric(12, 2) as gross,
  r.deduction_rate,
  private.deduction_of(coalesce(t.gross, 0), r.deduction_rate)::numeric(12, 2) as deduction,
  private.expected_net_of(coalesce(t.gross, 0), r.deduction_rate)::numeric(12, 2) as expected_net,
  coalesce(t.line_count, 0)::integer as line_count,
  coalesce(t.qty_differs_count, 0)::integer as qty_differs_count
from public.orders as o
join public.projects as p on p.id = o.project_id
left join lateral (
  select
    sum(lt.amount) as gross,
    count(*) as line_count,
    count(*) filter (where lt.qty_differs) as qty_differs_count
  from public.order_line_totals as lt
  where lt.order_id = o.id
) as t on true
cross join lateral (
  select coalesce(
    (
      select b.deduction_rate from public.bills as b
      where b.order_id = o.id and b.state = 'issued'
        and not exists (select 1 from public.bills as d where d.order_id = o.id and d.state = 'draft')
    ),
    p.deduction_rate
  ) as deduction_rate
) as r;

-- Per issued bill: what has been received and deducted, what is still owed, how old it is.
create view public.bill_balances
with (security_invoker = true)
as
select
  b.id as bill_id,
  b.order_id,
  b.number,
  b.issued_at,
  b.gross,
  b.deduction_rate,
  b.deduction,
  b.expected_net,
  s.received,
  s.deducted,
  (b.gross - s.received - s.deducted)::numeric(12, 2) as outstanding,
  -- What should still reach the bank, at the expected net.
  (case when b.gross - s.received - s.deducted > 0 then greatest(b.expected_net - s.received, 0) else 0 end)::numeric(12, 2) as expected_still,
  -- Received against expected: negative when the bank got less than expected.
  (s.received - b.expected_net)::numeric(12, 2) as received_vs_expected,
  d.days_outstanding,
  case
    when d.days_outstanding <= 30 then '0-30'
    when d.days_outstanding <= 60 then '31-60'
    when d.days_outstanding <= 90 then '61-90'
    else '90+'
  end as age_bucket
from public.bills as b
cross join lateral (
  select
    coalesce(sum(a.received_amount), 0)::numeric(12, 2) as received,
    coalesce(sum(a.deduction_amount), 0)::numeric(12, 2) as deducted
  from public.payment_allocations as a
  join public.bills as fb on fb.id = a.bill_id
  where fb.order_id = b.order_id
) as s
cross join lateral (
  select private.dhaka_today() - (b.issued_at at time zone 'Asia/Dhaka')::date as days_outstanding
) as d
where b.state = 'issued';

-- ---------------------------------------------------------------------------------------------
-- Access and bookkeeping
-- ---------------------------------------------------------------------------------------------

select private.grant_member_access('public.payments', 'select, delete');
grant insert (id, received_on, amount, method, bank_reference, raw_sms, notes)
  on table public.payments to authenticated;
grant update (received_on, amount, method, bank_reference, raw_sms, notes)
  on table public.payments to authenticated;

select private.grant_member_access('public.payment_allocations', 'select, delete');
grant insert (id, payment_id, bill_id, received_amount, deduction_amount)
  on table public.payment_allocations to authenticated;
grant update (received_amount, deduction_amount) on table public.payment_allocations to authenticated;

grant select on public.order_line_totals, public.order_totals, public.bill_balances
  to authenticated, service_role;

select private.track_updates('public.payments');
select private.track_updates('public.payment_allocations');
