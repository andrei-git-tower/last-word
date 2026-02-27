alter table public.insights
  add column if not exists user_email    text,
  add column if not exists user_plan     text,
  add column if not exists account_age   integer,
  add column if not exists seats         integer,
  add column if not exists mrr           integer;
