import { DEFAULT_DAILY_RISK_BUDGET, DEFAULT_SETUPS } from "./constants";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import type {
  ArchivedPlan,
  DailyRiskBudget,
  Direction,
  EntryMethod,
  PermissionToTrade,
  RiskControlState,
  ScenarioTrade,
  ScenarioValidation,
  SessionPlan,
  Setup,
  TechnicalStatus,
  TradeExecutionStatus,
  TradeExecutionType,
  WeeklyReport,
  WeeklySetupReport,
} from "./types";

export function getDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getInitialPlanDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getDateISO(date);
}

export function formatPlanDate(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || "—";

  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  const [year, month, day] = isoDate.split("-");
  const monthLabel = months[Number(month) - 1];

  return monthLabel ? `${Number(day)} ${monthLabel} ${year}` : isoDate;
}

export function createSessionPlan(planDate: string, symbol = DEFAULT_INSTRUMENT_SYMBOL, id = Date.now(), setup?: Setup): SessionPlan {
  const selectedSetup = setup ?? DEFAULT_SETUPS[0];
  const normalizedSymbol = normalizeInstrumentSymbol(symbol);

  return {
    id,
    planDate,
    status: "planned",
    closedAt: undefined,
    archivedAt: undefined,
    closeComment: "",
    chartImage: "",
    chartImageKey: "",
    originScenarioId: undefined,
    carriedFromDate: undefined,
    carryCount: 0,
    setupIds: selectedSetup?.id ? [selectedSetup.id] : [],
    setupNames: selectedSetup?.name ? [selectedSetup.name] : [],
    setupId: selectedSetup?.id ?? "",
    setupName: selectedSetup?.name ?? "Сетап не выбран",
    symbol: normalizedSymbol,
    direction: "long",
    entryZone: "",
    entryMethodId: "",
    entryMethodName: "",
    entryMethod: "",
    trigger: "",
    stop: "",
    take: "",
    note: "",
    resultStatus: "not_taken",
    technical: "yes",
    finalResult: "",
    archiveComment: "",
    tradeEntry: "",
    tradeStop: "",
    tradeTake: "",
    tradeRisk: "500",
    tradePointValue: getPointValuePerLot(normalizedSymbol),
    scenarioInvalidation: "",
    scenarioConfidence: "70",
    scenarioQuality: "",
    riskBudgetAllocation: "500",
    trades: [],
  };
}

export function createScenarioTrade(plan: SessionPlan, executionType: TradeExecutionType = "trade_1", id = createTradeId()): ScenarioTrade {
  const math = calculateScenarioTradeMath(plan);

  return {
    id,
    executionType,
    status: "planned",
    actualEntry: plan.tradeEntry,
    actualExit: "",
    actualSize: math.lot > 0 ? math.lot.toFixed(2) : "",
    actualStop: plan.tradeStop,
    actualTake: plan.tradeTake,
    actualRisk: plan.tradeRisk,
    actualResult: "",
    actualRr: "",
    executionNotes: "",
    executedAt: "",
    technical: "yes",
    slippage: "",
  };
}

export function createTradeId() {
  return `trade-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export function createDefaultRiskControls(overrides: Partial<RiskControlState> = {}): RiskControlState {
  return {
    sleep: 7,
    anxiety: 5,
    urge: 5,
    anger: 2,
    dailyPnl: 0,
    dailyLoss: "0",
    tradesToday: 0,
    consecutiveStops: "0",
    plan: false,
    newsChecked: false,
    stopSet: false,
    revenge: false,
    lockUntil: "",
    emergencyNote: "",
    updatedAt: "",
    ...overrides,
  };
}

export function getRiskControlsForDate(riskControlsByDate: Record<string, RiskControlState>, planDate: string): RiskControlState {
  return riskControlsByDate[planDate] ?? createDefaultRiskControls();
}

export function isPlanReady(plan: SessionPlan) {
  return validateScenarioPlan(plan).valid;
}

export function getInstrumentImageKey(date: string, symbol: string) {
  return `${date}:${normalizeInstrumentSymbol(symbol)}`;
}

export function getMarketIdeaKey(date: string, symbol: string, field: "bias" | "scenario") {
  return `${date}:${symbol}:${field}`;
}

export function getNextDateISO(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return getDateISO(date);
}

export function getWeekRange(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    weekStart: getDateISO(start),
    weekEnd: getDateISO(end),
  };
}

export function getSetupName(setups: Setup[], setupId: string, fallbackName = "Сетап не выбран") {
  return setups.find((setup) => setup.id === setupId)?.name ?? fallbackName;
}

export function getSetupNames(setups: Setup[], setupIds: string[], fallbackNames: string[] = []) {
  const names = setupIds
    .map((setupId, index) => setups.find((setup) => setup.id === setupId)?.name ?? fallbackNames[index] ?? "")
    .map((name) => name.trim())
    .filter(Boolean);

  return names.length > 0 ? names : fallbackNames.map((name) => name.trim()).filter(Boolean);
}

export function getActiveSetups(setups: Setup[]) {
  return setups.filter((setup) => setup.isActive);
}

export function getPreferredSetup(setups: Setup[]) {
  return getActiveSetups(setups)[0] ?? setups[0] ?? DEFAULT_SETUPS[0];
}

export function getPlanSetupNames(plan: Pick<SessionPlan, "setupIds" | "setupNames" | "setupId" | "setupName">) {
  const setupNames = Array.isArray(plan.setupNames) ? plan.setupNames.map((name) => name.trim()).filter(Boolean) : [];
  if (setupNames.length > 0) return setupNames;
  if (plan.setupName?.trim()) return [plan.setupName.trim()];
  return [];
}

export function getPlanSetupName(plan: Pick<SessionPlan, "setupIds" | "setupNames" | "setupId" | "setupName">) {
  return getPlanSetupNames(plan)[0] || "Сетап не выбран";
}

export function getPlanSetupLabel(plan: Pick<SessionPlan, "setupIds" | "setupNames" | "setupId" | "setupName">) {
  const names = getPlanSetupNames(plan);
  return names.length > 0 ? names.join(", ") : "Сетап не выбран";
}

export function getPlanEntryMethod(plan: Pick<SessionPlan, "entryMethod" | "entryMethodName" | "trigger">) {
  return plan.entryMethodName?.trim() || plan.entryMethod?.trim() || plan.trigger?.trim() || "";
}

export function createCustomSetup({ name, description = "", defaultInstrument = "" }: { name: string; description?: string; defaultInstrument?: string }): Setup {
  const now = new Date().toISOString();
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return {
    id: `custom-${slug || "setup"}-${Date.now()}`,
    name: name.trim(),
    description: description.trim(),
    defaultInstrument: defaultInstrument.trim().toUpperCase(),
    isDefault: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function getActiveEntryMethods(entryMethods: EntryMethod[]) {
  return entryMethods.filter((method) => method.isActive);
}

export function createCustomEntryMethod({ name, description = "" }: { name: string; description?: string }): EntryMethod {
  const now = new Date().toISOString();
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return {
    id: `custom-entry-${slug || "method"}-${Date.now()}`,
    name: name.trim(),
    description: description.trim(),
    isDefault: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function getDailyRiskBudget(budgets: Record<string, DailyRiskBudget>, planDate: string): DailyRiskBudget {
  return budgets[planDate] ?? { planDate, budgetUsd: DEFAULT_DAILY_RISK_BUDGET };
}

export function calculatePlannedRisk(plans: SessionPlan[], planDate: string) {
  return plans
    .filter((plan) => plan.planDate === planDate && isScenarioPlannedExposure(plan))
    .reduce((total, plan) => total + Math.max(0, Number(plan.tradeRisk) || 0), 0);
}

const factStatuses = new Set<TradeExecutionStatus>(["executed", "take", "stop", "manual_profit", "manual_loss", "breakeven"]);

export function isTradeFact(trade: ScenarioTrade) {
  return factStatuses.has(trade.status);
}

export function isTradeCompleted(trade: ScenarioTrade) {
  return trade.status === "take" || trade.status === "stop" || trade.status === "manual_profit" || trade.status === "manual_loss" || trade.status === "breakeven";
}

export function getScenarioTrades(plan: SessionPlan): ScenarioTrade[] {
  return Array.isArray(plan.trades) ? plan.trades : [];
}

export function getExecutedScenarioTrades(plan: SessionPlan) {
  return getScenarioTrades(plan).filter(isTradeFact);
}

export function getScenarioTotalResult(plan: SessionPlan) {
  const trades = getExecutedScenarioTrades(plan);
  if (trades.length === 0 && isScenarioClosed(plan)) return Number(plan.finalResult) || 0;
  if (trades.length === 0) return 0;
  return trades.reduce((total, trade) => total + (Number(trade.actualResult) || 0), 0);
}

export function getScenarioActualRr(plan: SessionPlan) {
  const trades = getExecutedScenarioTrades(plan);
  const rrValues = trades.map((trade) => Number(trade.actualRr)).filter((value) => Number.isFinite(value) && value > 0);
  if (rrValues.length === 0) return 0;
  return rrValues.reduce((total, value) => total + value, 0) / rrValues.length;
}

export function getScenarioExecutionQuality(plan: SessionPlan): TechnicalStatus {
  const trades = getExecutedScenarioTrades(plan);
  if (trades.length === 0) return plan.technical;
  if (trades.every((trade) => trade.technical === "yes")) return "yes";
  if (trades.some((trade) => trade.technical === "yes" || trade.technical === "partial")) return "partial";
  return "no";
}

export function getScenarioResultStatus(plan: SessionPlan): TradeExecutionStatus {
  const completedTrades = getScenarioTrades(plan).filter(isTradeCompleted);
  if (completedTrades.length === 0) return plan.resultStatus;
  return completedTrades[completedTrades.length - 1].status;
}

export function isScenarioClosed(plan: SessionPlan) {
  return plan.status === "closed" || plan.status === "archived";
}

export function isScenarioPlannedExposure(plan: SessionPlan) {
  return plan.status !== "closed" && plan.status !== "archived";
}

export function ensureScenarioCloseTrade(plan: SessionPlan): SessionPlan {
  if (plan.resultStatus === "not_taken" || plan.resultStatus === "no_entry") return syncLegacyResultFields(plan);
  if (getExecutedScenarioTrades(plan).length > 0) {
    let patched = false;
    const trades = getScenarioTrades(plan).map((trade) => {
      if (patched || !isTradeFact(trade)) return trade;
      patched = true;
      return {
        ...trade,
        status: trade.status === "executed" ? plan.resultStatus : trade.status,
        actualResult: trade.actualResult || plan.finalResult,
        executionNotes: trade.executionNotes || plan.closeComment || plan.archiveComment,
        executedAt: trade.executedAt || plan.closedAt || new Date().toISOString(),
        technical: trade.technical || plan.technical,
      };
    });

    return syncLegacyResultFields({ ...plan, trades });
  }

  const math = calculateScenarioTradeMath(plan);
  const trade = createScenarioTrade(plan, "trade_1", `close-trade-${plan.id}-${Date.now()}`);

  return syncLegacyResultFields({
    ...plan,
    trades: [
      ...getScenarioTrades(plan),
      {
        ...trade,
        status: plan.resultStatus,
        actualResult: plan.finalResult,
        actualRr: math.rr > 0 ? math.rr.toFixed(2) : "",
        executionNotes: plan.closeComment || plan.archiveComment || "",
        executedAt: plan.closedAt || new Date().toISOString(),
        technical: plan.technical,
      },
    ],
  });
}

export function syncLegacyResultFields(plan: SessionPlan): SessionPlan {
  const trades = getScenarioTrades(plan);
  const factTrades = trades.filter(isTradeFact);
  if (factTrades.length === 0) return plan;

  const resultStatus = getScenarioResultStatus(plan);
  const technical = getScenarioExecutionQuality(plan);
  const finalResult = String(getScenarioTotalResult(plan));

  return {
    ...plan,
    resultStatus: resultStatus === "executed" || resultStatus === "planned" ? plan.resultStatus : resultStatus,
    technical,
    finalResult,
  };
}

export function calculateWeeklyReport(archivedPlans: ArchivedPlan[], activePlanDate: string): WeeklyReport {
  const { weekStart, weekEnd } = getWeekRange(activePlanDate);
  const plans = archivedPlans.filter((plan) => plan.planDate >= weekStart && plan.planDate <= weekEnd);
  const tradeFacts = getArchivedTradeFacts(plans);
  const totalPnl = tradeFacts.reduce((total, item) => total + (Number(item.trade.actualResult) || 0), 0);
  const technicalTradeCount = tradeFacts.filter((item) => item.trade.technical === "yes").length;
  const setupStats = getSetupStats(tradeFacts);

  return {
    weekStart,
    weekEnd,
    totalPnl,
    tradeCount: tradeFacts.length,
    technicalTradeCount,
    technicalTradePercentage: tradeFacts.length > 0 ? Math.round((technicalTradeCount / tradeFacts.length) * 100) : 0,
    bestInstrument: bestTradeGroup(tradeFacts, (item) => item.plan.symbol),
    worstInstrument: worstTradeGroup(tradeFacts, (item) => item.plan.symbol),
    bestSetup: bestTradeGroupByLabels(tradeFacts, (item) => getPlanSetupNames(item.plan)),
    worstSetup: worstTradeGroupByLabels(tradeFacts, (item) => getPlanSetupNames(item.plan)),
    setupStats,
    stopCount: tradeFacts.filter((item) => item.trade.status === "stop").length,
    takeCount: tradeFacts.filter((item) => item.trade.status === "take").length,
    manualCloseCount: tradeFacts.filter((item) => item.trade.status === "manual_profit" || item.trade.status === "manual_loss" || item.trade.status === "breakeven").length,
    noEntryCount: plans.filter((plan) => getScenarioTrades(plan).length === 0 || getScenarioTrades(plan).every((trade) => trade.status === "planned")).length,
  };
}

type ArchivedTradeFact = { plan: ArchivedPlan; trade: ScenarioTrade };

function getArchivedTradeFacts(plans: ArchivedPlan[]): ArchivedTradeFact[] {
  return plans.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ plan, trade })));
}

function getSetupStats(tradeFacts: ArchivedTradeFact[]): WeeklySetupReport[] {
  const groups = new Map<string, { totalPnl: number; tradeCount: number; technicalCount: number }>();

  for (const item of tradeFacts) {
    const setupNames = getPlanSetupNames(item.plan);
    const labels = setupNames.length > 0 ? setupNames : ["Сетап не выбран"];

    for (const setupName of labels) {
      const current = groups.get(setupName) ?? { totalPnl: 0, tradeCount: 0, technicalCount: 0 };
      current.totalPnl += Number(item.trade.actualResult) || 0;
      current.tradeCount += 1;
      current.technicalCount += item.trade.technical === "yes" ? 1 : 0;
      groups.set(setupName, current);
    }
  }

  return [...groups.entries()]
    .map(([setupName, stats]) => ({
      setupName,
      totalPnl: stats.totalPnl,
      tradeCount: stats.tradeCount,
      technicalTradePercentage: stats.tradeCount > 0 ? Math.round((stats.technicalCount / stats.tradeCount) * 100) : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

export function calculatePermission({
  status,
  executionReadiness,
  emotionalReadiness,
  disciplineReadiness,
  dailyRiskRemaining,
  revengeDetectorScore,
  personalDailyStopHit,
  tradesToday,
  consecutiveStops,
  bestScenarioRisk,
  bestScenarioLot,
}: {
  status: "OK" | "CAUTION" | "DANGER" | "LOCKED";
  executionReadiness: number;
  emotionalReadiness: number;
  disciplineReadiness: number;
  dailyRiskRemaining: number;
  revengeDetectorScore: number;
  personalDailyStopHit: boolean;
  tradesToday: number;
  consecutiveStops: number;
  bestScenarioRisk: number;
  bestScenarioLot: number;
}): PermissionToTrade {
  const scenarioRisk = Math.max(0, bestScenarioRisk);
  const scenarioLot = Math.max(0, bestScenarioLot);
  const scaleLot = (allowedRisk: number) => (scenarioRisk > 0 && scenarioLot > 0 ? scenarioLot * (allowedRisk / scenarioRisk) : 0);

  if (status === "LOCKED" || personalDailyStopHit || dailyRiskRemaining <= 0 || revengeDetectorScore >= 60 || consecutiveStops >= 3) {
    return {
      permission: "denied",
      maxAllowedRisk: 0,
      maxAllowedLot: 0,
      maxAdditionalTrades: 0,
      reEntryAllowed: false,
      instruction: "Торговля запрещена. Закрой терминал и сделай разбор.",
    };
  }

  const readinessFloor = Math.min(executionReadiness, emotionalReadiness, disciplineReadiness);
  const maxAdditionalTrades = Math.max(0, 3 - tradesToday);

  if (status === "DANGER" || status === "CAUTION" || readinessFloor < 70 || revengeDetectorScore >= 35 || consecutiveStops >= 2 || tradesToday >= 2) {
    const maxAllowedRisk = Math.max(0, Math.min(dailyRiskRemaining, scenarioRisk || dailyRiskRemaining, 250));
    return {
      permission: "reduced",
      maxAllowedRisk,
      maxAllowedLot: scaleLot(maxAllowedRisk),
      maxAdditionalTrades: Math.min(maxAdditionalTrades, 1),
      reEntryAllowed: false,
      instruction: "Только одна попытка минимальным риском. После стопа повторный вход запрещён.",
    };
  }

  const maxAllowedRisk = Math.max(0, Math.min(dailyRiskRemaining, scenarioRisk || dailyRiskRemaining, 500));
  return {
    permission: "granted",
    maxAllowedRisk,
    maxAllowedLot: scaleLot(maxAllowedRisk),
    maxAdditionalTrades,
    reEntryAllowed: true,
    instruction: "Торговать можно только по готовому сценарию с заранее заданным стопом.",
  };
}

function bestTradeGroup(tradeFacts: ArchivedTradeFact[], getKey: (item: ArchivedTradeFact) => string) {
  return sortedTradeGroup(tradeFacts, getKey, "best");
}

function worstTradeGroup(tradeFacts: ArchivedTradeFact[], getKey: (item: ArchivedTradeFact) => string) {
  return sortedTradeGroup(tradeFacts, getKey, "worst");
}

function bestTradeGroupByLabels(tradeFacts: ArchivedTradeFact[], getLabels: (item: ArchivedTradeFact) => string[]) {
  return sortedTradeGroupByLabels(tradeFacts, getLabels, "best");
}

function worstTradeGroupByLabels(tradeFacts: ArchivedTradeFact[], getLabels: (item: ArchivedTradeFact) => string[]) {
  return sortedTradeGroupByLabels(tradeFacts, getLabels, "worst");
}

function sortedTradeGroup(tradeFacts: ArchivedTradeFact[], getKey: (item: ArchivedTradeFact) => string, mode: "best" | "worst") {
  const totals = new Map<string, number>();

  for (const item of tradeFacts) {
    const key = getKey(item);
    totals.set(key, (totals.get(key) ?? 0) + (Number(item.trade.actualResult) || 0));
  }

  const sorted = [...totals.entries()].sort((a, b) => (mode === "best" ? b[1] - a[1] : a[1] - b[1]));
  if (!sorted[0]) return "—";
  return `${sorted[0][0]} (${formatCurrency(sorted[0][1])})`;
}

function sortedTradeGroupByLabels(tradeFacts: ArchivedTradeFact[], getLabels: (item: ArchivedTradeFact) => string[], mode: "best" | "worst") {
  const totals = new Map<string, number>();

  for (const item of tradeFacts) {
    const labels = getLabels(item);
    const safeLabels = labels.length > 0 ? labels : ["Сетап не выбран"];
    for (const label of safeLabels) {
      totals.set(label, (totals.get(label) ?? 0) + (Number(item.trade.actualResult) || 0));
    }
  }

  const sorted = [...totals.entries()].sort((a, b) => (mode === "best" ? b[1] - a[1] : a[1] - b[1]));
  if (!sorted[0]) return "—";
  return `${sorted[0][0]} (${formatCurrency(sorted[0][1])})`;
}

export function formatCurrency(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}

export function formatSyncStatus(status: string) {
  if (!status) return "сохранено локально";

  if (status.startsWith("Sync error:")) {
    return status.replace("Sync error:", "Ошибка синхронизации:");
  }

  const labels: Record<string, string> = {
    "Saved locally": "сохранено локально",
    "Syncing…": "синхронизация...",
    Synced: "синхронизировано",
    "Offline / Supabase unavailable": "офлайн / Supabase недоступен",
    "Sync error": "ошибка синхронизации",
  };

  if (labels[status]) return labels[status];

  return status
    .replaceAll("Saved locally", labels["Saved locally"])
    .replaceAll("Syncing…", labels["Syncing…"])
    .replaceAll("Synced", labels.Synced)
    .replaceAll("Offline / Supabase unavailable", labels["Offline / Supabase unavailable"])
    .replaceAll("Sync error", labels["Sync error"]);
}

export function calculateScenarioTradeMath(item: SessionPlan) {
  const entry = Number(item.tradeEntry);
  const stop = Number(item.tradeStop);
  const take = Number(item.tradeTake);
  const risk = Number(item.tradeRisk);
  const pointValue = Number(item.tradePointValue);
  const stopDistance = Math.abs(entry - stop);
  const takeDistance = Math.abs(take - entry);
  const lot = stopDistance > 0 && pointValue > 0 && risk > 0 ? risk / (stopDistance * pointValue) : 0;
  const potential = lot * takeDistance * pointValue;
  const rr = stopDistance > 0 ? takeDistance / stopDistance : 0;
  const hasData = Boolean(item.tradeEntry && item.tradeStop && item.tradeTake && item.tradeRisk && item.tradePointValue);

  return { stopDistance, takeDistance, lot, potential, rr, hasData };
}

export function validateScenarioPlan(item: SessionPlan): ScenarioValidation {
  const reasons: string[] = [];
  const math = calculateScenarioTradeMath(item);

  if (!item.symbol) reasons.push("не выбран инструмент");
  if (!item.direction) reasons.push("не выбрано направление");
  const setupCount = getPlanSetupNames(item).length;
  if (setupCount === 0) reasons.push("не выбран сетап");
  if (setupCount > 5) reasons.push("выбрано больше 5 сетапов");
  if (!item.entryZone || !item.tradeEntry) reasons.push("не заполнена точка входа");
  if (!getPlanEntryMethod(item)) reasons.push("не выбран способ входа");
  if (!item.stop || !item.tradeStop) reasons.push("не заполнен технический стоп");
  if (!item.take || !item.tradeTake) reasons.push("не заполнен технический тейк");
  if ((Number(item.tradeRisk) || 0) <= 0) reasons.push("риск на сделку не задан");
  if ((Number(item.tradePointValue) || 0) <= 0) reasons.push("стоимость пункта не задана");
  if (math.lot <= 0 && math.hasData) reasons.push("лотность не рассчитана");
  if (math.rr <= 0 && math.hasData) reasons.push("RR не рассчитан");

  return {
    valid: reasons.length === 0 && math.lot > 0 && math.rr > 0,
    reasons: [...new Set(reasons)],
    math,
  };
}

export function getBestValidScenario(plans: SessionPlan[]) {
  return plans
    .map((plan) => ({ plan, validation: validateScenarioPlan(plan) }))
    .filter((item) => item.validation.valid)
    .sort((a, b) => b.validation.math.rr - a.validation.math.rr || Number(b.plan.tradeRisk) - Number(a.plan.tradeRisk))[0];
}

export function coerceDirection(value: string): Direction {
  if (value === "short" || value === "both") return value;
  return "long";
}
