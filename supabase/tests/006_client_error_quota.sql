begin;
select plan(5);

-- now() is fixed for the whole transaction, so every call lands in the same minute window.
select is(
  (select bool_and(public.consume_client_error_quota('ip:198.51.100.7', 3))
   from generate_series(1, 3)),
  true,
  'reports within the per-minute limit are accepted'
);
select is(
  public.consume_client_error_quota('ip:198.51.100.7', 3),
  false,
  'the report over the limit is refused'
);
select is(
  public.consume_client_error_quota('ip:203.0.113.9', 3),
  true,
  'another caller keeps its own quota'
);
select function_privs_are('public', 'consume_client_error_quota', array['text', 'integer'],
  'anon', array[]::text[], 'anon cannot consume quota directly');
select function_privs_are('public', 'consume_client_error_quota', array['text', 'integer'],
  'authenticated', array[]::text[], 'authenticated cannot consume quota directly');

select * from finish();
rollback;
