-- Security invariants that every migration must keep (BLUEPRINT §5.9): only members read or write,
-- anon reaches nothing, and every function is either private or deliberately granted.
begin;
\ir _setup.psql
select plan(12);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null,
  'every table in public has row level security on'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  null,
  'every table in public has a policy'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
       or has_any_column_privilege('anon', c.oid, 'select, insert, update, references'))),
  null,
  'anon has no privilege on any table or view in public'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   -- CASE keeps the privilege check off indexes and tables, where it would raise an error.
   where n.nspname = 'public'
     and case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage, select, update') else false end),
  null,
  'anon has no privilege on any sequence in public'
);

select is(
  (select array_agg(p.oid::regprocedure::text order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon can run no function in public'
);

-- Functions members may call through the Data API. Add to this list deliberately.
select set_eq(
  $$ select p.oid::regprocedure::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array[]::text[],
  'members can run only the approved functions in public'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('authenticated', c.oid, 'select, insert, update, delete, truncate')
       or has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate'))),
  null,
  'no table in private is open to anon or members'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot even look inside the private schema'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
  null,
  'every view in public runs with the caller''s rights, so RLS applies'
);

select is(
  (select array_agg(p.oid::regprocedure::text order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not exists (select 1 from unnest(p.proconfig) as setting where setting like 'search_path=%')),
  null,
  'every function in public and private pins its search_path'
);

select is(
  (select array_agg(p.oid::regprocedure::text order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon can run no security definer function in private'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and not (has_table_privilege('service_role', c.oid, 'select')
       and has_table_privilege('service_role', c.oid, 'insert')
       and has_table_privilege('service_role', c.oid, 'update')
       and has_table_privilege('service_role', c.oid, 'delete'))),
  null,
  'the service role (Edge Functions, PDF service) can work with every table in public'
);

select * from finish();
rollback;
