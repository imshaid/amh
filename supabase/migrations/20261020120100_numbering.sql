-- Numbering (BLUEPRINT §4): per fiscal year, atomic, never reused, generated in Postgres.
-- Orders are numbered when they are created (AMH/26-27/0047); bills when they are issued, in their
-- own sequence by issue date (AMH/27-28/B-0001); a revision keeps its bill's number with a suffix
-- (AMH/27-28/B-0001-R1); challans get a short number that is stable within their order.

create table private.number_sequences (
  scope text not null,
  -- The fiscal year ('26-27') for orders and bills; the order's id for its challans.
  key text not null,
  last_value integer not null constraint number_sequences_last_value_positive check (last_value > 0),
  primary key (scope, key)
);

comment on table private.number_sequences is
  'Last number handed out per sequence. Only private.next_number writes here.';

-- The next number in a sequence. The upsert locks the sequence row until the calling transaction
-- ends, so concurrent callers queue and each number is handed out once. A rolled-back caller rolls
-- the increment back too, so committed numbers have no gaps.
create function private.next_number(p_scope text, p_key text)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.number_sequences as s (scope, key, last_value)
  values (p_scope, p_key, 1)
  on conflict (scope, key) do update set last_value = s.last_value + 1
  returning s.last_value
$$;

-- The fiscal year containing a date, as '26-27' (2026-07-01 to 2027-06-30 when years start in July).
create function private.fiscal_year_of(p_date date, p_start_month integer)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0')
  from (
    select extract(year from p_date)::integer
      - case when extract(month from p_date)::integer < p_start_month then 1 else 0 end as start_year
  ) as fiscal
$$;

-- Today's fiscal year, by the business settings.
create function private.current_fiscal_year()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.fiscal_year_of(private.dhaka_today(), fiscal_year_start_month)
  from public.business_settings
$$;

-- At least four digits, never truncated: 47 -> '0047', 12345 -> '12345'.
create function private.pad_number(p_value integer)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lpad(p_value::text, greatest(4, length(p_value::text)), '0')
$$;

create function private.format_order_number(p_prefix text, p_fiscal_year text, p_seq integer)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select p_prefix || '/' || p_fiscal_year || '/' || private.pad_number(p_seq)
$$;

-- Revision 0 is the original bill; revision n prints its number with -Rn.
create function private.format_bill_number(
  p_prefix text,
  p_fiscal_year text,
  p_seq integer,
  p_revision integer
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select p_prefix || '/' || p_fiscal_year || '/B-' || private.pad_number(p_seq)
    || case when p_revision > 0 then '-R' || p_revision::text else '' end
$$;
