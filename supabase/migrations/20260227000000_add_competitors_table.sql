create table public.competitors (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references public.accounts(id) on delete cascade,
  name        text        not null,
  questions   text[]      not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.competitors enable row level security;

create policy "competitors: owner only"
  on public.competitors for all
  using (auth.uid() = account_id);
