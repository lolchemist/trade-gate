alter table public.trade_gate_state_snapshots enable row level security;
alter table public.trade_gate_trading_days enable row level security;
alter table public.trade_gate_scenarios enable row level security;
alter table public.trade_gate_executions enable row level security;
alter table public.trade_gate_risk_controls enable row level security;
alter table public.trade_gate_emotional_snapshots enable row level security;
alter table public.trade_gate_daily_risk_budgets enable row level security;
alter table public.trade_gate_account_settings enable row level security;
alter table public.trade_gate_instrument_images enable row level security;
alter table public.trade_gate_journal_notes enable row level security;
alter table public.trade_gate_sync_events enable row level security;

drop policy if exists "trade_gate_snapshots_nataliia_access" on public.trade_gate_state_snapshots;
create policy "trade_gate_snapshots_nataliia_access"
on public.trade_gate_state_snapshots
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_days_nataliia_access" on public.trade_gate_trading_days;
create policy "trade_gate_days_nataliia_access"
on public.trade_gate_trading_days
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_scenarios_nataliia_access" on public.trade_gate_scenarios;
create policy "trade_gate_scenarios_nataliia_access"
on public.trade_gate_scenarios
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_executions_nataliia_access" on public.trade_gate_executions;
create policy "trade_gate_executions_nataliia_access"
on public.trade_gate_executions
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_risk_controls_nataliia_access" on public.trade_gate_risk_controls;
create policy "trade_gate_risk_controls_nataliia_access"
on public.trade_gate_risk_controls
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_emotional_snapshots_nataliia_access" on public.trade_gate_emotional_snapshots;
create policy "trade_gate_emotional_snapshots_nataliia_access"
on public.trade_gate_emotional_snapshots
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_daily_risk_budgets_nataliia_access" on public.trade_gate_daily_risk_budgets;
create policy "trade_gate_daily_risk_budgets_nataliia_access"
on public.trade_gate_daily_risk_budgets
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_account_settings_nataliia_access" on public.trade_gate_account_settings;
create policy "trade_gate_account_settings_nataliia_access"
on public.trade_gate_account_settings
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_instrument_images_nataliia_access" on public.trade_gate_instrument_images;
create policy "trade_gate_instrument_images_nataliia_access"
on public.trade_gate_instrument_images
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_journal_notes_nataliia_access" on public.trade_gate_journal_notes;
create policy "trade_gate_journal_notes_nataliia_access"
on public.trade_gate_journal_notes
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');

drop policy if exists "trade_gate_sync_events_nataliia_access" on public.trade_gate_sync_events;
create policy "trade_gate_sync_events_nataliia_access"
on public.trade_gate_sync_events
for all
to anon
using (sync_key = 'nataliia-main')
with check (sync_key = 'nataliia-main');
