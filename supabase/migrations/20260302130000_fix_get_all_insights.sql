-- Fix 1: get_all_insights() — scope to calling user's account only.
-- Previously returned ALL insights with no WHERE clause (SECURITY DEFINER + no filter = full data leak).
drop function if exists public.get_all_insights();

create or replace function public.get_all_insights()
returns setof public.insights
language sql
security definer
set search_path = public
as $$
  select * from public.insights
  where account_id = auth.uid()
  order by created_at desc;
$$;

-- Fix 2: rules UPDATE policy — add WITH CHECK so a user cannot change a row's account_id
-- to a different account's UUID after passing the USING check.
drop policy if exists "rules_update_own" on public.rules;

create policy "rules_update_own" on public.rules
  for update
  using (account_id = auth.uid())
  with check (account_id = auth.uid());
