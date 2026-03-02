-- Restrict get_all_insights() to the admin account only.
-- All other callers get only their own insights.
create or replace function public.get_all_insights()
returns setof public.insights
language sql
security definer
set search_path = public
as $$
  select * from public.insights
  where
    (select email from auth.users where id = auth.uid()) = 'andrei@git-tower.com'
    or account_id = auth.uid()
  order by created_at desc;
$$;
