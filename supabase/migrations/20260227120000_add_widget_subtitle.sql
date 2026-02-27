alter table public.configs
  add column if not exists widget_subtitle text not null default '';
