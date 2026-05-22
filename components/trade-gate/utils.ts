import { DEFAULT_DAILY_RISK_BUDGET, DEFAULT_SETUPS } from "./constants";
import type { ArchivedPlan, DailyRiskBudget, Direction, PermissionToTrade, ScenarioValidation, SessionPlan, Setup, TradeDirection, TradeMath, WeeklyReport, WeeklySetupReport } from "./types";

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

export function createSessionPlan(planDate: string, symbol = "BCOUSD", id = Date.now(), setup?: Setup): SessionPlan {
  const selectedSetup = setup ?? DEFAULT_SETUPS[0];

  return {
    id,
    planDate,
    originScenarioId: undefined,
    carriedFromDate: undefined,
    carryCount: 0,
    setupId: selectedSetup?.id ?? "",
    setupName: selectedSetup?.name ?? "Сетап не выбран",
    symbol,
    direction: "long",
    entryZone: "",
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
    tradePointValue: "1000",
    entryReason: "",
  };
}

export function isPlanReady(plan: SessionPlan) {
  return validateScenarioPlan(plan).valid;
}

export function getInstrumentImageKey(date: string, symbol: string) {
  return `${date}:${symbol}`;
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

export function getActiveSetups(setups: Setup[]) {
  return setups.filter((setup) => setup.isActive);
}

export function getPreferredSetup(setups: Setup[]) {
  return getActiveSetups(setups)[0] ?? setups[0] ?? DEFAULT_SETUPS[0];
}

export function getPlanSetupName(plan: Pick<SessionPlan, "setupId" | "setupName">) {
  return plan.setupName || "Сетап не выбран";
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

export function getDailyRiskBudget(budgets: Record<string, DailyRiskBudget>, planDate: string): DailyRiskBudget {
  return budgets[planDate] ?? { planDate, budgetUsd: DEFAULT_DAILY_RISK_BUDGET };
}

export function calculatePlannedRisk(plans: SessionPlan[], planDate: string) {
  return plans
    .filter((plan) => plan.planDate === planDate)
    .reduce((total, plan) => total + Math.max(0, Number(plan.tradeRisk) || 0), 0);
}

export function calculateWeeklyReport(archivedPlans: ArchivedPlan[], activePlanDate: string): WeeklyReport {
  const { weekStart, weekEnd } = getWeekRange(activePlanDate);
  const plans = archivedPlans.filter((plan) => plan.planDate >= weekStart && plan.planDate <= weekEnd);
  const tradePlans = plans.filter((plan) => plan.resultStatus !== "not_taken");
  const totalPnl = tradePlans.reduce((total, plan) => total + (Number(plan.finalResult) || 0), 0);
  const technicalTradeCount = tradePlans.filter((plan) => plan.technical === "yes").length;
  const setupStats = getSetupStats(tradePlans);

  return {
    weekStart,
    weekEnd,
    totalPnl,
    tradeCount: tradePlans.length,
    technicalTradeCount,
    technicalTradePercentage: tradePlans.length > 0 ? Math.round((technicalTradeCount / tradePlans.length) * 100) : 0,
    bestInstrument: bestGroup(tradePlans, (plan) => plan.symbol),
    worstInstrument: worstGroup(tradePlans, (plan) => plan.symbol),
    bestSetup: bestGroup(tradePlans, getPlanSetupName),
    worstSetup: worstGroup(tradePlans, getPlanSetupName),
    setupStats,
    stopCount: plans.filter((plan) => plan.resultStatus === "stop").length,
    takeCount: plans.filter((plan) => plan.resultStatus === "take").length,
    manualCloseCount: plans.filter((plan) => plan.resultStatus === "manual_profit" || plan.resultStatus === "manual_loss" || plan.resultStatus === "breakeven").length,
    noEntryCount: plans.filter((plan) => plan.resultStatus === "not_taken").length,
  };
}

function getSetupStats(plans: ArchivedPlan[]): WeeklySetupReport[] {
  const groups = new Map<string, { totalPnl: number; tradeCount: number; technicalCount: number }>();

  for (const plan of plans) {
    const setupName = getPlanSetupName(plan);
    const current = groups.get(setupName) ?? { totalPnl: 0, tradeCount: 0, technicalCount: 0 };
    current.totalPnl += Number(plan.finalResult) || 0;
    current.tradeCount += 1;
    current.technicalCount += plan.technical === "yes" ? 1 : 0;
    groups.set(setupName, current);
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

function bestGroup(plans: ArchivedPlan[], getKey: (plan: ArchivedPlan) => string) {
  return sortedGroup(plans, getKey, "best");
}

function worstGroup(plans: ArchivedPlan[], getKey: (plan: ArchivedPlan) => string) {
  return sortedGroup(plans, getKey, "worst");
}

function sortedGroup(plans: ArchivedPlan[], getKey: (plan: ArchivedPlan) => string, mode: "best" | "worst") {
  const totals = new Map<string, number>();

  for (const plan of plans) {
    const key = getKey(plan);
    totals.set(key, (totals.get(key) ?? 0) + (Number(plan.finalResult) || 0));
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

export function calculateTradeMath({
  entryPrice,
  stopPrice,
  takePrice,
  riskDollars,
  dollarsPerPointPerLot,
  direction,
  entryReason,
}: {
  entryPrice: number | string;
  stopPrice: number | string;
  takePrice: number | string;
  riskDollars: number | string;
  dollarsPerPointPerLot: number | string;
  direction: TradeDirection;
  entryReason: string;
}): TradeMath {
  const entry = Number(entryPrice);
  const stop = Number(stopPrice);
  const take = Number(takePrice);
  const risk = Number(riskDollars);
  const pointValue = Number(dollarsPerPointPerLot);
  const stopDistance = Math.abs(entry - stop);
  const takeDistance = Math.abs(take - entry);
  const lots = stopDistance > 0 && pointValue > 0 && risk > 0 ? risk / (stopDistance * pointValue) : 0;
  const rewardDollars = lots * takeDistance * pointValue;
  const rr = stopDistance > 0 ? takeDistance / stopDistance : 0;
  const stopValid = direction === "long" ? stop < entry : stop > entry;
  const takeValid = direction === "long" ? take > entry : take < entry;

  return {
    stopDistance,
    takeDistance,
    lots,
    rewardDollars,
    rr,
    stopValid,
    takeValid,
    valid: stopDistance > 0 && takeDistance > 0 && risk > 0 && pointValue > 0 && stopValid && takeValid && entryReason.trim().length > 8,
  };
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
  if (!item.setupId) reasons.push("не выбран сетап");
  if (!item.entryZone || !item.tradeEntry) reasons.push("не заполнена точка входа");
  if (!item.trigger) reasons.push("не заполнен триггер");
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

export function coerceTradeDirection(value: string): TradeDirection {
  return value === "short" ? "short" : "long";
}
