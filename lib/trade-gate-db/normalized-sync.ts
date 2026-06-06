import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateActiveScenarioRisk, calculateScenarioExecutionRisk, calculateScenarioTradeMath, getExecutedScenarioTrades, getPlanEntryMethod, getScenarioArguments, getScenarioTrades } from "@/components/trade-gate/utils";
import type { DailyRiskBudget, FTMODailyState, PlanningState, RiskControlState, ScenarioTrade, SessionPlan } from "@/types/trade-gate";

type JsonRecord = Record<string, unknown>;
type SupabaseWriteResult = {
  error: { message: string } | null;
};

const SNAPSHOTS_TABLE = "trade_gate_state_snapshots";
const TRADING_DAYS_TABLE = "trade_gate_trading_days";
const SCENARIOS_TABLE = "trade_gate_scenarios";
const EXECUTIONS_TABLE = "trade_gate_executions";
const RISK_CONTROLS_TABLE = "trade_gate_risk_controls";
const EMOTIONAL_SNAPSHOTS_TABLE = "trade_gate_emotional_snapshots";
const DAILY_RISK_BUDGETS_TABLE = "trade_gate_daily_risk_budgets";
const ACCOUNT_SETTINGS_TABLE = "trade_gate_account_settings";
const FTMO_DAILY_STATES_TABLE = "trade_gate_ftmo_daily_states";
const INSTRUMENT_IMAGES_TABLE = "trade_gate_instrument_images";
const JOURNAL_NOTES_TABLE = "trade_gate_journal_notes";
const SYNC_EVENTS_TABLE = "trade_gate_sync_events";

export async function persistNormalizedTradeGateState(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  try {
    await insertStateSnapshot(supabase, state, savedAt);
    await Promise.all([
      upsertTradingDays(supabase, state, savedAt),
      upsertScenarios(supabase, state, savedAt),
      upsertRiskControls(supabase, state, savedAt),
      upsertDailyRiskBudgets(supabase, state, savedAt),
      upsertAccountSettings(supabase, state, savedAt),
      upsertFtmoDailyStates(supabase, state, savedAt),
      upsertInstrumentImages(supabase, state, savedAt),
      upsertJournalNotes(supabase, state, savedAt),
    ]);
    await insertSyncEvent(supabase, state.syncKey, "normalized_sync", "ok", savedAt);
  } catch (error) {
    console.warn("Trade Gate normalized sync skipped", error);
  }
}

async function insertStateSnapshot(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  await writeOrThrow(
    supabase.from(SNAPSHOTS_TABLE).insert({
      sync_key: state.syncKey,
      source: "web_app",
      app_version: "trade-gate-next",
      payload: state as unknown as JsonRecord,
      footprint: getStateFootprint(state) as unknown as JsonRecord,
      created_at: savedAt,
    })
  );
}

async function upsertTradingDays(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = getPlanDates(state).map((planDate) => {
    const plansForDate = getAllPlans(state).filter((plan) => plan.planDate === planDate);
    const archivedForDate = state.archivedPlans.filter((plan) => plan.planDate === planDate);
    const realizedPnl = archivedForDate.reduce((total, plan) => total + (Number(plan.finalResult) || 0), 0);
    const closedLossToday = archivedForDate.reduce((total, plan) => {
      const scenarioPnl = getExecutedScenarioTrades(plan).reduce((sum, trade) => sum + (Number(trade.actualResult) || 0), 0);
      return scenarioPnl < 0 ? total + Math.abs(scenarioPnl) : total;
    }, 0);
    const activeRisk = plansForDate.filter((plan) => plan.status === "active").reduce((total, plan) => total + calculateActiveScenarioRisk(plan), 0);
    const totalPlannedRisk = plansForDate.filter((plan) => plan.status === "planned").reduce((total, plan) => total + (Number(plan.tradeRisk) || 0), 0);
    const status = state.tradingDayStatuses[planDate] ?? state.tradingDayStatusByDate[planDate] ?? "active";

    return {
      sync_key: state.syncKey,
      plan_date: planDate,
      status,
      active_scenarios_count: plansForDate.filter((plan) => plan.status !== "archived").length,
      archived_scenarios_count: archivedForDate.length,
      daily_pnl: realizedPnl,
      planned_risk: totalPlannedRisk,
      payload: {
        riskControls: state.riskControlsByDate[planDate],
        dailyRiskBudget: state.dailyRiskBudgets[planDate],
        usedRisk: closedLossToday + activeRisk,
        activeRisk,
        closedLossToday,
      },
      updated_at: savedAt,
    };
  });

  if (rows.length > 0) await writeOrThrow(supabase.from(TRADING_DAYS_TABLE).upsert(rows, { onConflict: "sync_key,plan_date" }));
}

async function upsertScenarios(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const plansById = new Map<string, SessionPlan>();
  for (const plan of getAllPlans(state)) plansById.set(String(plan.id), plan);
  const scenarioRows = [...plansById.values()].map((plan) => createScenarioRow(state.syncKey, plan, savedAt));
  if (scenarioRows.length > 0) await writeOrThrow(supabase.from(SCENARIOS_TABLE).upsert(scenarioRows, { onConflict: "sync_key,scenario_id" }));

  const executionRows = [...plansById.values()].flatMap((plan) => createExecutionRows(state.syncKey, plan, savedAt));
  if (executionRows.length > 0) await writeOrThrow(supabase.from(EXECUTIONS_TABLE).upsert(executionRows, { onConflict: "sync_key,scenario_id,execution_id" }));
}

function createScenarioRow(syncKey: string, plan: SessionPlan, savedAt: string) {
  const math = calculateScenarioTradeMath(plan);
  const result = Number(plan.finalResult) || 0;
  const argumentsList = getScenarioArguments(plan);

  return {
    sync_key: syncKey,
    scenario_id: String(plan.id),
    origin_scenario_id: plan.originScenarioId ? String(plan.originScenarioId) : null,
    plan_date: plan.planDate,
    symbol: plan.symbol,
    direction: plan.direction,
    status: plan.status,
    entry_method: getPlanEntryMethod(plan) || null,
    entry_zone: plan.entryZone || null,
    planned_entry: plan.tradeEntry || null,
    planned_stop: plan.tradeStop || plan.stop || null,
    planned_take: plan.tradeTake || plan.take || null,
    planned_risk: Number(plan.tradeRisk) || 0,
    point_value: Number(plan.tradePointValue) || 0,
    planned_lot: math.lot || 0,
    planned_rr: math.rr || 0,
    planned_potential: math.potential || 0,
    result_status: plan.resultStatus,
    technical_status: plan.technical,
    final_result: result,
    scenario_arguments: argumentsList,
    argument_ids: plan.argumentIds ?? [],
    carry_count: Number(plan.carryCount) || 0,
    carried_from_date: plan.carriedFromDate ?? null,
    closed_at: plan.closedAt || null,
    archived_at: plan.archivedAt || null,
    chart_image_key: plan.chartImageKey || null,
    chart_image_present: Boolean(plan.chartImage),
    payload: plan as unknown as JsonRecord,
    updated_at: savedAt,
  };
}

function createExecutionRows(syncKey: string, plan: SessionPlan, savedAt: string) {
  const trades = getScenarioTrades(plan);
  const normalizedTrades = trades.length > 0 ? trades : createLegacyExecution(plan);

  return normalizedTrades.map((trade, index) => {
    const executionMath = calculateScenarioExecutionRisk(plan, trade);

    return {
      sync_key: syncKey,
      scenario_id: String(plan.id),
      execution_id: trade.id || `legacy-${plan.id}-${index}`,
      execution_type: trade.executionType,
      status: trade.status,
      actual_entry: trade.actualEntry || null,
      actual_exit: trade.actualExit || null,
      actual_size: Number(trade.actualSize) || 0,
      actual_stop: trade.actualStop || null,
      actual_take: trade.actualTake || null,
      actual_risk: Number(trade.actualRisk) || executionMath.risk || Number(plan.tradeRisk) || 0,
      actual_result: Number(trade.actualResult) || 0,
      actual_rr: Number(trade.actualRr) || executionMath.rr || 0,
      technical_status: trade.technical,
      executed_at: trade.executedAt || plan.closedAt || plan.archivedAt || null,
      payload: trade as unknown as JsonRecord,
      updated_at: savedAt,
    };
  });
}

function createLegacyExecution(plan: SessionPlan): ScenarioTrade[] {
  if (!plan.resultStatus || plan.resultStatus === "not_taken") return [];

  return [
    {
      id: `legacy-${plan.id}`,
      executionType: "trade_1",
      status: plan.resultStatus,
      actualEntry: plan.tradeEntry,
      actualExit: "",
      actualSize: "",
      actualStop: plan.tradeStop,
      actualTake: plan.tradeTake,
      actualRisk: plan.tradeRisk,
      actualResult: plan.finalResult,
      actualRr: "",
      executionNotes: plan.archiveComment,
      executedAt: plan.closedAt || plan.archivedAt || "",
      technical: plan.technical,
      slippage: "",
    },
  ];
}

async function upsertRiskControls(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = Object.entries(state.riskControlsByDate).map(([planDate, controls]) => ({
    sync_key: state.syncKey,
    plan_date: planDate,
    sleep: Number(controls.sleep) || 0,
    anxiety: Number(controls.anxiety) || 0,
    urge: Number(controls.urge) || 0,
    anger: Number(controls.anger) || 0,
    daily_pnl: Number(controls.dailyPnl) || 0,
    daily_loss: Number(controls.dailyLoss) || 0,
    trades_today: Number(controls.tradesToday) || 0,
    consecutive_stops: Number(controls.consecutiveStops) || 0,
    plan_checked: Boolean(controls.plan),
    news_checked: Boolean(controls.newsChecked),
    stop_set: Boolean(controls.stopSet),
    revenge: Boolean(controls.revenge),
    lock_until: controls.lockUntil || null,
    emergency_note: controls.emergencyNote || null,
    payload: controls as unknown as JsonRecord,
    updated_at: savedAt,
  }));

  if (rows.length > 0) await writeOrThrow(supabase.from(RISK_CONTROLS_TABLE).upsert(rows, { onConflict: "sync_key,plan_date" }));

  const emotionalRows = Object.entries(state.riskControlsByDate).flatMap(([planDate, controls]) => createEmotionalSnapshotRows(state.syncKey, planDate, controls));
  if (emotionalRows.length > 0) await writeOrThrow(supabase.from(EMOTIONAL_SNAPSHOTS_TABLE).upsert(emotionalRows, { onConflict: "sync_key,plan_date,recorded_at" }));
}

function createEmotionalSnapshotRows(syncKey: string, planDate: string, controls: RiskControlState) {
  if (!Array.isArray(controls.emotionalHistory)) return [];

  return controls.emotionalHistory.map((snapshot) => ({
    sync_key: syncKey,
    plan_date: planDate,
    anxiety: Number(snapshot.anxiety) || 0,
    urge: Number(snapshot.urge) || 0,
    anger: Number(snapshot.anger) || 0,
    recorded_at: snapshot.recordedAt,
    payload: snapshot as unknown as JsonRecord,
  }));
}

async function upsertDailyRiskBudgets(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = Object.values(state.dailyRiskBudgets).map((budget: DailyRiskBudget) => ({
    sync_key: state.syncKey,
    plan_date: budget.planDate,
    budget_usd: Number(budget.budgetUsd) || 0,
    payload: budget as unknown as JsonRecord,
    updated_at: savedAt,
  }));

  if (rows.length > 0) await writeOrThrow(supabase.from(DAILY_RISK_BUDGETS_TABLE).upsert(rows, { onConflict: "sync_key,plan_date" }));
}

async function upsertAccountSettings(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  await writeOrThrow(
    supabase.from(ACCOUNT_SETTINGS_TABLE).upsert(
      {
        sync_key: state.syncKey,
        account_size: Number(state.accountSettings.accountSize) || 0,
        prop_daily_loss_limit: Number(state.accountSettings.propDailyLossLimit) || 0,
        personal_daily_stop: Number(state.accountSettings.personalDailyStop) || 0,
        personal_max_risk_per_trade: Number(state.accountSettings.personalMaxRiskPerTrade) || 0,
        max_loss_limit: Number(state.accountSettings.maxLossLimit) || 0,
        personal_max_loss: Number(state.accountSettings.personalMaxLoss) || 0,
        profit_target: Number(state.accountSettings.profitTarget) || 0,
        ftmo_settings: state.ftmoSettings as unknown as JsonRecord,
        local_session_settings: state.localSessionSettings as unknown as JsonRecord,
        payload: {
          accountSettings: state.accountSettings,
          ftmoSettings: state.ftmoSettings,
          localSessionSettings: state.localSessionSettings,
        } as unknown as JsonRecord,
        updated_at: savedAt,
      },
      { onConflict: "sync_key" }
    )
  );
}

async function upsertFtmoDailyStates(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = Object.values(state.ftmoDailyStateByFtmoTradingDay).map((dailyState: FTMODailyState) => ({
    sync_key: state.syncKey,
    ftmo_trading_day: dailyState.ftmoTradingDay,
    start_of_day_balance: Number(dailyState.startOfDayBalance) || 0,
    start_of_day_equity: Number(dailyState.startOfDayEquity) || 0,
    current_balance: Number(dailyState.currentBalance) || 0,
    current_equity: Number(dailyState.currentEquity) || 0,
    closed_pnl_today: Number(dailyState.closedPnlToday) || 0,
    floating_pnl: Number(dailyState.floatingPnl) || 0,
    commissions: Number(dailyState.commissions) || 0,
    swaps: Number(dailyState.swaps) || 0,
    deposits_withdrawals_adjustment: Number(dailyState.depositsWithdrawalsAdjustment) || 0,
    payload: dailyState as unknown as JsonRecord,
    updated_at: savedAt,
  }));

  if (rows.length > 0) await writeOrThrow(supabase.from(FTMO_DAILY_STATES_TABLE).upsert(rows, { onConflict: "sync_key,ftmo_trading_day" }));
}

async function upsertInstrumentImages(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = Object.entries(state.instrumentImages).map(([imageKey, imageValue]) => {
    const [planDate, ...symbolParts] = imageKey.split(":");
    const symbol = symbolParts.join(":");

    return {
      sync_key: state.syncKey,
      image_key: imageKey,
      plan_date: planDate || state.activePlanDate,
      symbol: symbol || "",
      storage_path: null,
      has_image: Boolean(imageValue),
      image_bytes: typeof imageValue === "string" ? imageValue.length : 0,
      payload: { imageKey },
      updated_at: savedAt,
    };
  });

  if (rows.length > 0) await writeOrThrow(supabase.from(INSTRUMENT_IMAGES_TABLE).upsert(rows, { onConflict: "sync_key,image_key" }));
}

async function upsertJournalNotes(supabase: SupabaseClient, state: PlanningState, savedAt: string) {
  const rows = Object.entries(state.marketIdeaNotes)
    .filter(([, note]) => note.trim())
    .map(([noteKey, note]) => ({
      sync_key: state.syncKey,
      note_key: noteKey,
      note,
      payload: { noteKey },
      updated_at: savedAt,
    }));

  if (rows.length > 0) await writeOrThrow(supabase.from(JOURNAL_NOTES_TABLE).upsert(rows, { onConflict: "sync_key,note_key" }));
}

async function insertSyncEvent(supabase: SupabaseClient, syncKey: string, eventType: string, status: string, savedAt: string) {
  await writeOrThrow(
    supabase.from(SYNC_EVENTS_TABLE).insert({
      sync_key: syncKey,
      event_type: eventType,
      status,
      created_at: savedAt,
    })
  );
}

function getAllPlans(state: PlanningState) {
  return [...state.sessionPlans, ...state.archivedPlans];
}

function getPlanDates(state: PlanningState) {
  return [
    state.activePlanDate,
    ...getAllPlans(state).map((plan) => plan.planDate),
    ...Object.keys(state.riskControlsByDate),
    ...Object.keys(state.dailyRiskBudgets),
    ...Object.keys(state.tradingDayStatuses),
    ...Object.keys(state.tradingDayStatusByDate),
  ].filter(Boolean).filter((date, index, dates) => dates.indexOf(date) === index);
}

function getStateFootprint(state: PlanningState) {
  const sessionPlans = Array.isArray(state.sessionPlans) ? state.sessionPlans : [];
  const archivedPlans = Array.isArray(state.archivedPlans) ? state.archivedPlans : [];
  const allPlans = [...sessionPlans, ...archivedPlans];
  const trades = allPlans.reduce((count, plan) => count + getScenarioTrades(plan).length, 0);

  return {
    sessionPlans: sessionPlans.length,
    archivedPlans: archivedPlans.length,
    trades,
    images: Object.values(state.instrumentImages).filter(Boolean).length,
    riskControls: Object.keys(state.riskControlsByDate).length,
    dailyRiskBudgets: Object.keys(state.dailyRiskBudgets).length,
    marketIdeaNotes: Object.keys(state.marketIdeaNotes).length,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

async function writeOrThrow(request: PromiseLike<SupabaseWriteResult>) {
  const { error } = await request;
  if (error) throw error;
}
