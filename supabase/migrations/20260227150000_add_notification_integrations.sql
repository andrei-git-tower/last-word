-- Notification integrations (webhook/slack) and delivery logs.

create table if not exists public.notification_endpoints (
  id                  uuid        primary key default gen_random_uuid(),
  account_id          uuid        not null references public.accounts(id) on delete cascade,
  name                text        not null default '',
  provider            text        not null check (provider in ('webhook', 'slack')),
  target_url          text        not null check (target_url ~ '^https?://'),
  signing_secret      text        not null default '',
  auth_header_name    text,
  auth_header_value   text,
  enabled             boolean     not null default true,
  event_type          text        not null default 'interview_completed'
                                check (event_type in ('interview_completed')),
  delivery_mode       text        not null default 'realtime'
                                check (delivery_mode in ('realtime', 'daily', 'weekly')),
  digest_hour_utc     smallint    not null default 9
                                check (digest_hour_utc >= 0 and digest_hour_utc <= 23),
  digest_weekday_utc  smallint    not null default 1
                                check (digest_weekday_utc >= 0 and digest_weekday_utc <= 6),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists notification_endpoints_account_id_idx
  on public.notification_endpoints(account_id);

create index if not exists notification_endpoints_enabled_idx
  on public.notification_endpoints(account_id, enabled);

create table if not exists public.notification_deliveries (
  id               uuid        primary key default gen_random_uuid(),
  account_id       uuid        not null references public.accounts(id) on delete cascade,
  endpoint_id      uuid        references public.notification_endpoints(id) on delete set null,
  insight_id       uuid        references public.insights(id) on delete set null,
  event_type       text        not null default 'interview_completed'
                             check (event_type in ('interview_completed')),
  status           text        not null check (status in ('success', 'failed', 'skipped')),
  payload          jsonb       not null default '{}'::jsonb,
  http_status      integer,
  duration_ms      integer,
  error_message    text,
  response_body    text,
  attempted_at     timestamptz not null default now()
);

create index if not exists notification_deliveries_account_id_idx
  on public.notification_deliveries(account_id, attempted_at desc);

create index if not exists notification_deliveries_endpoint_id_idx
  on public.notification_deliveries(endpoint_id, attempted_at desc);

-- Keep updated_at in sync on endpoint edits.
create or replace function public.set_notification_endpoint_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_endpoints_updated_at on public.notification_endpoints;
create trigger trg_notification_endpoints_updated_at
before update on public.notification_endpoints
for each row execute procedure public.set_notification_endpoint_updated_at();

-- RLS
alter table public.notification_endpoints enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "notification_endpoints: owner only"
  on public.notification_endpoints for all
  using (auth.uid() = account_id);

create policy "notification_deliveries: owner only"
  on public.notification_deliveries for all
  using (auth.uid() = account_id);
