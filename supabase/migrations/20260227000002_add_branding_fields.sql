alter table public.configs
  add column if not exists brand_logo_url    text not null default '',
  add column if not exists brand_primary_color text not null default '',
  add column if not exists brand_button_color  text not null default '',
  add column if not exists brand_font          text not null default '';
