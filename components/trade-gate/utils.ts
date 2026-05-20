import type { Direction, SessionPlan, TradeDirection, TradeMath } from "./types";

export function getDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getInitialPlanDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return getDateISO(date);
}

export function formatPlanDate(isoDate: string) {
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
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

export function createSessionPlan(planDate: string, symbol = "BCOUSD", id = Date.now()): SessionPlan {
  return {
    id,
    planDate,
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
  return Boolean(plan.symbol && plan.direction && plan.entryZone && plan.trigger && plan.stop && plan.take);
}

export function getInstrumentImageKey(date: string, symbol: string) {
  return `${date}:${symbol}`;
}

export function getMarketIdeaKey(date: string, symbol: string, field: "bias" | "scenario") {
  return `${date}:${symbol}:${field}`;
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
  const lots = stopDistance > 0 && pointValue > 0 ? risk / (stopDistance * pointValue) : 0;
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
    valid: stopDistance > 0 && takeDistance > 0 && stopValid && takeValid && entryReason.trim().length > 8,
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

export function coerceDirection(value: string): Direction {
  if (value === "short" || value === "both") return value;
  return "long";
}

export function coerceTradeDirection(value: string): TradeDirection {
  return value === "short" ? "short" : "long";
}
