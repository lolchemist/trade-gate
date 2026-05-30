create extension if not exists pgcrypto;

create table if not exists public.trade_gate_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  source text not null default 'web_app',
  app_version text not null default 'trade-gate-next',
  payload jsonb not null,
  footprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_gate_trading_days (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  plan_date date not null,
  status text not null default 'active',
  active_scenarios_count integer not null default 0,
  archived_scenarios_count integer not null default 0,
  daily_pnl numeric not null default 0,
  planned_risk numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, plan_date)
);

create table if not exists public.trade_gate_scenarios (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  scenario_id text not null,
  origin_scenario_id text,
  plan_date date not null,
  symbol text not null,
  direction text not null,
  status text not null default 'planned',
  entry_method text,
  entry_zone text,
  planned_entry text,
  planned_stop text,
  planned_take text,
  planned_risk numeric not null default 0,
  point_value numeric not null default 0,
  planned_lot numeric not null default 0,
  planned_rr numeric not null default 0,
  planned_potential numeric not null default 0,
  result_status text not null default 'not_taken',
  technical_status text not null default 'yes',
  final_result numeric not null default 0,
  scenario_arguments jsonb not null default '[]'::jsonb,
  argument_ids jsonb not null default '[]'::jsonb,
  carry_count integer not null default 0,
  carried_from_date date,
  closed_at timestamptz,
  archived_at timestamptz,
  chart_image_key text,
  chart_image_present boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, scenario_id)
);

create table if not exists public.trade_gate_executions (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  scenario_id text not null,
  execution_id text not null,
  execution_type text not null default 'trade_1',
  status text not null default 'planned',
  actual_entry text,
  actual_exit text,
  actual_size numeric not null default 0,
  actual_stop text,
  actual_take text,
  actual_risk numeric not null default 0,
  actual_result numeric not null default 0,
  actual_rr numeric not null default 0,
  technical_status text not null default 'yes',
  executed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, scenario_id, execution_id)
);

create table if not exists public.trade_gate_risk_controls (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  plan_date date not null,
  sleep numeric not null default 0,
  anxiety numeric not null default 0,
  urge numeric not null default 0,
  anger numeric not null default 0,
  daily_pnl numeric not null default 0,
  daily_loss numeric not null default 0,
  trades_today integer not null default 0,
  consecutive_stops integer not null default 0,
  plan_checked boolean not null default false,
  news_checked boolean not null default false,
  stop_set boolean not null default false,
  revenge boolean not null default false,
  lock_until timestamptz,
  emergency_note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, plan_date)
);

create table if not exists public.trade_gate_emotional_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  plan_date date not null,
  anxiety numeric not null default 0,
  urge numeric not null default 0,
  anger numeric not null default 0,
  recorded_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (sync_key, plan_date, recorded_at)
);

create table if not exists public.trade_gate_daily_risk_budgets (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  plan_date date not null,
  budget_usd numeric not null default 1000,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, plan_date)
);

create table if not exists public.trade_gate_account_settings (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null unique,
  account_size numeric not null default 100000,
  prop_daily_loss_limit numeric not null default 5000,
  personal_daily_stop numeric not null default 1000,
  personal_max_risk_per_trade numeric not null default 500,
  max_loss_limit numeric not null default 10000,
  personal_max_loss numeric not null default 3000,
  profit_target numeric not null default 10000,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_gate_instrument_images (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  image_key text not null,
  plan_date date not null,
  symbol text not null,
  storage_path text,
  has_image boolean not null default false,
  image_bytes integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, image_key)
);

create table if not exists public.trade_gate_journal_notes (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  note_key text not null,
  note text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sync_key, note_key)
);

create table if not exists public.trade_gate_sync_events (
  id uuid primary key default gen_random_uuid(),
  sync_key text not null,
  event_type text not null,
  status text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trade_gate_snapshots_sync_key_created_at_idx
  on public.trade_gate_state_snapshots (sync_key, created_at desc);

create index if not exists trade_gate_scenarios_sync_key_plan_date_idx
  on public.trade_gate_scenarios (sync_key, plan_date desc);

create index if not exists trade_gate_scenarios_sync_key_symbol_idx
  on public.trade_gate_scenarios (sync_key, symbol);

create index if not exists trade_gate_executions_sync_key_scenario_id_idx
  on public.trade_gate_executions (sync_key, scenario_id);

create index if not exists trade_gate_executions_sync_key_executed_at_idx
  on public.trade_gate_executions (sync_key, executed_at desc);

create index if not exists trade_gate_risk_controls_sync_key_plan_date_idx
  on public.trade_gate_risk_controls (sync_key, plan_date desc);

create index if not exists trade_gate_emotional_snapshots_sync_key_plan_date_idx
  on public.trade_gate_emotional_snapshots (sync_key, plan_date desc, recorded_at desc);

create index if not exists trade_gate_instrument_images_sync_key_plan_date_symbol_idx
  on public.trade_gate_instrument_images (sync_key, plan_date desc, symbol);
