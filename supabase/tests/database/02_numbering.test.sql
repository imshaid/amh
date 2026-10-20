-- Fiscal years, number formats and sequences (BLUEPRINT §4: per fiscal year, atomic, never reused).
begin;
\ir _setup.psql
select plan(19);

-- Fiscal years run July to June ----------------------------------------------------------------

select is(private.fiscal_year_of('2026-07-01', 7), '26-27', 'the first of July starts a new fiscal year');
select is(private.fiscal_year_of('2026-06-30', 7), '25-26', 'the thirtieth of June still belongs to the old one');
select is(private.fiscal_year_of('2027-06-30', 7), '26-27', 'a fiscal year ends on the thirtieth of June');
select is(private.fiscal_year_of('2026-10-20', 7), '26-27', 'October is early in the year');
select is(private.fiscal_year_of('2099-08-01', 7), '99-00', 'the century wraps');
select is(private.fiscal_year_of('2026-03-15', 4), '25-26', 'another start month moves the boundary');
select is(
  private.current_fiscal_year(),
  private.fiscal_year_of(private.dhaka_today(), 7),
  'today''s fiscal year follows the settings and Bangladesh time'
);

-- Formats ------------------------------------------------------------------------------------

select is(private.pad_number(7), '0007', 'numbers have at least four digits');
select is(private.pad_number(12345), '12345', 'and are never cut short');
select is(private.format_order_number('AMH', '26-27', 47), 'AMH/26-27/0047', 'an order number');
select is(private.format_bill_number('AMH', '27-28', 1, 0), 'AMH/27-28/B-0001', 'a bill number');
select is(private.format_bill_number('AMH', '27-28', 1, 1), 'AMH/27-28/B-0001-R1', 'a revision keeps the number and adds R1');
select is(private.format_bill_number('AMH', '27-28', 1, 12), 'AMH/27-28/B-0001-R12', 'and counts on');

-- Sequences ----------------------------------------------------------------------------------

select is(private.next_number('test', '26-27'), 1, 'a new sequence starts at one');
select is(private.next_number('test', '26-27'), 2, 'and counts up');
select is(private.next_number('test', '27-28'), 1, 'each fiscal year counts on its own');
select is(private.next_number('other', '26-27'), 1, 'and so does each scope');

select tests.create_member('01711000001') as alice \gset
select tests.act_as(:'alice');
select throws_ok($$ select private.next_number('test', '26-27') $$, '42501', null, 'members cannot hand out numbers themselves');
select throws_ok($$ select * from private.number_sequences $$, '42501', null, 'or read the counters');
reset role;

select * from finish();
rollback;
