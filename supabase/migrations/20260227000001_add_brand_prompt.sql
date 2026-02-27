alter table public.configs
  add column if not exists brand_prompt text not null default '';
