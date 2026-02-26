-- 1. accounts: one row per Supabase auth user
create table public.accounts (
  id         uuid        primary key references auth.users(id) on delete cascade,
  email      text        not null,
  api_key    text        not null unique default ('lw_' || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now()
);

-- 2. configs: one row per account (created manually after signup for now)
create table public.configs (
  id                  uuid        primary key default gen_random_uuid(),
  account_id          uuid        not null unique references public.accounts(id) on delete cascade,
  product_name        text        not null,
  product_description text        not null default '',
  competitors         text[]      not null default '{}',
  plans               jsonb       not null default '[]',
  retention_paths     jsonb       not null default '{}',
  updated_at          timestamptz not null default now()
);

-- 3. insights: one row per completed interview
create table public.insights (
  id                 uuid        primary key default gen_random_uuid(),
  account_id         uuid        not null references public.accounts(id) on delete cascade,
  surface_reason     text        not null default '',
  deep_reasons       text[]      not null default '{}',
  sentiment          text        not null default 'neutral',
  salvageable        boolean     not null default false,
  key_quote          text        not null default '',
  category           text        not null default 'other',
  competitor         text,
  feature_gaps       text[]      not null default '{}',
  usage_duration     text,
  retention_path     text        not null default '',
  retention_accepted boolean     not null default false,
  raw_transcript     jsonb       not null default '[]',
  created_at         timestamptz not null default now()
);

-- RLS
alter table public.accounts enable row level security;
alter table public.configs  enable row level security;
alter table public.insights enable row level security;

-- accounts: owner only
create policy "accounts: owner only"
  on public.accounts for all
  using (auth.uid() = id);

-- configs: owner only
create policy "configs: owner only"
  on public.configs for all
  using (auth.uid() = account_id);

-- insights: owner only
create policy "insights: owner only"
  on public.insights for all
  using (auth.uid() = account_id);

-- Auto-create account row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.accounts (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
