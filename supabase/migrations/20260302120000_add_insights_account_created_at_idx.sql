create index if not exists insights_account_created_at_idx
  on public.insights(account_id, created_at desc);
