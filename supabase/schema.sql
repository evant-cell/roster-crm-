-- Roster CRM schema. Run this once in the Supabase SQL editor on a fresh project.

create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  company text default '',
  email text default '',
  phone text default '',
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'contracted', 'lost')),
  last_contacted date,
  next_followup date,
  source text default '',
  est_value numeric default 0,
  tags text[] default '{}',
  notes text default '',
  qual boolean[] default '{false,false,false,false}',
  custom jsonb default '{}',
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  type text check (type in ('note', 'call', 'email', 'stage', 'import')),
  body text default '',
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'
);

create unique index if not exists leads_email_unique
  on leads (lower(email))
  where email <> '' and archived_at is null;

create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_next_followup_idx on leads (next_followup);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row
  execute function set_updated_at();

insert into settings (key, value) values
  ('checklist', '["Has budget","Decision maker reached","Timeline inside 90 days","Fits service area"]'),
  ('stale_days', '14'),
  ('digest', '{"enabled":true,"hour":8}')
on conflict (key) do nothing;
