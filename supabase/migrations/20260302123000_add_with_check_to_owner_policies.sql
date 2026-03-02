-- Make write constraints explicit on owner policies.
-- This keeps current ownership semantics while reducing future policy-regression risk.

drop policy if exists "accounts: owner only" on public.accounts;
create policy "accounts: owner only"
  on public.accounts for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "configs: owner only" on public.configs;
create policy "configs: owner only"
  on public.configs for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

drop policy if exists "insights: owner only" on public.insights;
create policy "insights: owner only"
  on public.insights for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

drop policy if exists "competitors: owner only" on public.competitors;
create policy "competitors: owner only"
  on public.competitors for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

drop policy if exists "notification_endpoints: owner only" on public.notification_endpoints;
create policy "notification_endpoints: owner only"
  on public.notification_endpoints for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

drop policy if exists "notification_deliveries: owner only" on public.notification_deliveries;
create policy "notification_deliveries: owner only"
  on public.notification_deliveries for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);
