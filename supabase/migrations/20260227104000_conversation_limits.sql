-- Per-account conversation length controls for exit interviews.
alter table public.configs
  add column min_exchanges integer not null default 3,
  add column max_exchanges integer not null default 5;

alter table public.configs
  add constraint configs_min_exchanges_range check (min_exchanges >= 1 and min_exchanges <= 20),
  add constraint configs_max_exchanges_range check (max_exchanges >= 1 and max_exchanges <= 20),
  add constraint configs_exchanges_order check (min_exchanges <= max_exchanges);
