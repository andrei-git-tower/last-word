create or replace function public.get_all_insights()
returns setof public.insights
language sql
security definer
set search_path = public
as $$
  select * from public.insights order by created_at desc;
$$;
