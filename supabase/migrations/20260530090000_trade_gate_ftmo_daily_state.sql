create extension if not exists pgcrypto;

alter table public.trade_gate_account_settings
  add column if not exists ftmo_settings jsonb not null default '{}'::jsonb,
  add column if not exists local_session_settings jsonb not null default '{}'::jsonb;

create table if not exists public.trade_gate_ftmo_daily_states (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  ftmo_trading_day date not null,
  start_of_day_balance numeric not null default 0,
  start_of_day_equity numeric not null default 0,
  current_balance numeric not null default 0,
  current_equity numeric not null default 0,
  closed_pnl_today numeric not null default 0,
  floating_pnl numeric not null default 0,
  commissions numeric not null default 0,
  swaps numeric not null default 0,
  deposits_withdrawals_adjustment numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, ftmo_trading_day)
);

alter table public.trade_gate_ftmo_daily_states enable row level security;

drop policy if exists "trade_gate_ftmo_daily_states_nataliia_access" on public.trade_gate_ftmo_daily_states;
create policy "trade_gate_ftmo_daily_states_nataliia_access"
on public.trade_gate_ftmo_daily_states
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

create index if not exists trade_gate_ftmo_daily_states_sync_key_day_idx
  on public.trade_gate_ftmo_daily_states (sync_key, ftmo_trading_day desc);
