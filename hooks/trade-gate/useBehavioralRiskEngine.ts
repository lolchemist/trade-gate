import { useMemo } from "react";
import { calculateExecutionQuality } from "@/hooks/trade-gate/useExecutionQuality";
import { calculateScenarioQuality } from "@/hooks/trade-gate/useScenarioQuality";
import { getExecutedScenarioTrades, getScenarioArguments, getScenarioTrades } from "@/components/trade-gate/utils";
import type { AccountSettings, ArchivedPlan, RiskControlState, ScenarioTrade, SessionPlan, TodayMetrics } from "@/types/trade-gate";

export type BehavioralState = "GREEN" | "YELLOW" | "ORANGE" | "RED";
export type RecommendedMode = "normal" | "reduced" | "sim_only" | "locked";

export type BehavioralRiskResult = {
  state: BehavioralState;
  mode: RecommendedMode;
  revengeScore: number;
  qualityDecay: number;
  emotionalSlope: number;
  cognitiveClarity: number;
  sessionQuality: number;
  maxAllowedRisk: number;
  cooldownMinutes: number;
  reasons: string[];
  warnings: string[];
  instruction: string;
  flags: {
    rapidTradeFrequency: boolean;
    reEntryAfterStop: boolean;
    switchingAfterStop: boolean;
    largeRiskIncrease: boolean;
    weakScenarioDescriptions: boolean;
    profitEuphoria: boolean;
    emotionalSpike: boolean;
    qualityDeteriorating: boolean;
    lateSessionFatigue: boolean;
  };
};

export function useBehavioralRiskEngine({
  activePlanDate,
  sessionPlans,
  archivedPlans,
  riskControls,
  todayMetrics,
  accountSettings,
}: {
  activePlanDate: string;
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  riskControls: RiskControlState;
  todayMetrics: TodayMetrics;
  accountSettings: AccountSettings;
}): BehavioralRiskResult {
  return useMemo(
    () => calculateBehavioralRisk({ activePlanDate, sessionPlans, archivedPlans, riskControls, todayMetrics, accountSettings }),
    [activePlanDate, sessionPlans, archivedPlans, riskControls, todayMetrics, accountSettings]
  );
}

function calculateBehavioralRisk({
  activePlanDate,
  sessionPlans,
  archivedPlans,
  riskControls,
  todayMetrics,
  accountSettings,
}: {
  activePlanDate: string;
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  riskControls: RiskControlState;
  todayMetrics: TodayMetrics;
  accountSettings: AccountSettings;
}): BehavioralRiskResult {
  const activePlans = sessionPlans.filter((plan) => plan.planDate === activePlanDate);
  const archivedPlansForDate = archivedPlans.filter((plan) => plan.planDate === activePlanDate);
  const allPlans = [...activePlans, ...archivedPlansForDate];
  const facts = allPlans.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ plan, trade })));
  const orderedFacts = [...facts].sort((a, b) => getTradeTime(a.trade, a.plan) - getTradeTime(b.trade, b.plan));
  const pressure = (Number(riskControls.anxiety) || 0) + (Number(riskControls.urge) || 0) + (Number(riskControls.anger) || 0);
  const emotionalSlope = calculateEmotionalSlope(riskControls);
  const qualityScores = orderedFacts.map((fact) => calculateExecutionQuality(fact.plan, fact.trade).score);
  const scenarioQualityAverage = average(activePlans.map((plan) => calculateScenarioQuality(plan, Boolean(plan.chartImage)).score));
  const qualityDecay = calculateQualityDecay(qualityScores);
  const rapidTradeFrequency = hasRapidTrades(orderedFacts);
  const reEntryAfterStop = hasReEntryAfterStop(orderedFacts);
  const switchingAfterStop = hasSwitchingAfterStop(orderedFacts);
  const largeRiskIncrease = hasLargeRiskIncrease(orderedFacts);
  const weakScenarioDescriptions = activePlans.some(hasWeakScenarioDescription);
  const emotionalSpike = Number(riskControls.anxiety) >= 8 || Number(riskControls.urge) >= 8 || Number(riskControls.anger) >= 7 || emotionalSlope >= 5;
  const accountSize = Number(accountSettings.accountSize) || 10000;
  const dailyRiskBudget = Number(todayMetrics.dailyRiskBudget.budgetUsd) || 0;
  const profitEuphoria = (dailyRiskBudget > 0 && todayMetrics.realizedPnl >= dailyRiskBudget * 2) || todayMetrics.realizedPnl >= accountSize * 0.015;
  const lateSessionFatigue = isLateSession(orderedFacts);
  const qualityDeteriorating = qualityDecay >= 20 || (qualityScores.length >= 2 && qualityScores[qualityScores.length - 1] < 55);
  const revengeScore = clamp(
    (riskControls.revenge ? 35 : 0) +
      pressure * 2 +
      emotionalSlope * 4 +
      todayMetrics.consecutiveStops * 14 +
      (rapidTradeFrequency ? 16 : 0) +
      (reEntryAfterStop ? 16 : 0) +
      (switchingAfterStop ? 12 : 0) +
      (largeRiskIncrease ? 10 : 0) +
      (todayMetrics.realizedPnl < 0 ? 8 : 0) +
      (lateSessionFatigue ? 6 : 0) +
      (profitEuphoria ? 10 : 0),
    0,
    100
  );
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (riskControls.revenge) reasons.push("включён revenge toggle");
  if (rapidTradeFrequency) reasons.push("несколько входов за короткий период");
  if (reEntryAfterStop) reasons.push("повторный вход после стопа");
  if (switchingAfterStop) reasons.push("переключение инструмента после стопа: эмоция переносится между рынками");
  if (largeRiskIncrease) reasons.push("резкий рост фактического риска после предыдущих сделок");
  if (emotionalSpike) reasons.push("эмоциональный всплеск: тревога / импульс / злость растут");
  if (qualityDeteriorating) reasons.push("Decision quality is deteriorating");
  if (profitEuphoria) warnings.push("сильный прибыльный день: риск эйфории и желания push");
  if (weakScenarioDescriptions) warnings.push("часть сценариев описана слишком коротко: растёт риск импульсного входа");
  if (lateSessionFatigue) warnings.push("поздняя фаза сессии: когнитивная усталость повышает риск");

  let state: BehavioralState = "GREEN";
  if (revengeScore >= 75 || riskControls.revenge) state = "RED";
  else if (revengeScore >= 60 || emotionalSpike || rapidTradeFrequency || reEntryAfterStop || qualityDecay >= 30) state = "ORANGE";
  else if (revengeScore >= 30 || todayMetrics.consecutiveStops === 1 || profitEuphoria || qualityDeteriorating || weakScenarioDescriptions) state = "YELLOW";

  const mode: RecommendedMode = state === "RED" ? "locked" : state === "ORANGE" ? "sim_only" : state === "YELLOW" ? "reduced" : "normal";
  const cooldownMinutes = state === "RED" ? 120 : state === "ORANGE" ? (rapidTradeFrequency ? 30 : 60) : state === "YELLOW" ? (profitEuphoria || todayMetrics.consecutiveStops === 1 ? 30 : 0) : 0;
  const cognitiveClarity = clamp(100 - pressure * 2 - emotionalSlope * 5 - (lateSessionFatigue ? 15 : 0), 0, 100);
  const sessionQuality = clamp(Math.round((scenarioQualityAverage || 70) - qualityDecay - todayMetrics.tradesToday * 5 - (rapidTradeFrequency ? 15 : 0)), 0, 100);
  const maxAllowedRisk = state === "GREEN" ? todayMetrics.remainingRisk : state === "YELLOW" ? Math.min(todayMetrics.remainingRisk, accountSize * 0.0025) : 0;

  return {
    state,
    mode,
    revengeScore,
    qualityDecay,
    emotionalSlope,
    cognitiveClarity,
    sessionQuality,
    maxAllowedRisk: Math.max(0, maxAllowedRisk),
    cooldownMinutes,
    reasons,
    warnings,
    instruction: getBehaviorInstruction(state, cooldownMinutes),
    flags: {
      rapidTradeFrequency,
      reEntryAfterStop,
      switchingAfterStop,
      largeRiskIncrease,
      weakScenarioDescriptions,
      profitEuphoria,
      emotionalSpike,
      qualityDeteriorating,
      lateSessionFatigue,
    },
  };
}

function getBehaviorInstruction(state: BehavioralState, cooldownMinutes: number) {
  if (state === "RED") return "Ты сейчас торгуешь не рынок, а своё состояние. Закрой терминал и сделай разбор.";
  if (state === "ORANGE") return cooldownMinutes > 0 ? `Только симуляция или обязательный cooldown ${cooldownMinutes} минут.` : "Только симуляция. Живой риск сейчас не нужен.";
  if (state === "YELLOW") return "Only one attempt allowed. No re-entry after stop. Максимум 0.25% риска.";
  return "Нормальный режим: торговать только готовый сценарий, без переноса эмоций между инструментами.";
}

function calculateEmotionalSlope(riskControls: RiskControlState) {
  const history = riskControls.emotionalHistory ?? [];
  if (history.length < 2) return 0;
  const first = history[0];
  const last = history[history.length - 1];
  return Math.max(0, last.anxiety - first.anxiety) + Math.max(0, last.urge - first.urge) + Math.max(0, last.anger - first.anger);
}

function calculateQualityDecay(scores: number[]) {
  if (scores.length < 2) return 0;
  return Math.max(0, scores[0] - scores[scores.length - 1]);
}

function hasRapidTrades(facts: Array<{ plan: SessionPlan; trade: ScenarioTrade }>) {
  for (let index = 1; index < facts.length; index += 1) {
    const previous = getTradeTime(facts[index - 1].trade, facts[index - 1].plan);
    const current = getTradeTime(facts[index].trade, facts[index].plan);
    if (Number.isFinite(previous) && Number.isFinite(current) && current - previous <= 30 * 60 * 1000) return true;
  }
  return false;
}

function hasReEntryAfterStop(facts: Array<{ plan: SessionPlan; trade: ScenarioTrade }>) {
  return facts.some((fact, index) => index > 0 && fact.trade.executionType === "re_entry" && facts[index - 1].trade.status === "stop");
}

function hasSwitchingAfterStop(facts: Array<{ plan: SessionPlan; trade: ScenarioTrade }>) {
  return facts.some((fact, index) => index > 0 && facts[index - 1].trade.status === "stop" && facts[index - 1].plan.symbol !== fact.plan.symbol);
}

function hasLargeRiskIncrease(facts: Array<{ plan: SessionPlan; trade: ScenarioTrade }>) {
  for (let index = 1; index < facts.length; index += 1) {
    const previousRisk = Number(facts[index - 1].trade.actualRisk) || Number(facts[index - 1].plan.tradeRisk) || 0;
    const currentRisk = Number(facts[index].trade.actualRisk) || Number(facts[index].plan.tradeRisk) || 0;
    if (previousRisk > 0 && currentRisk > previousRisk * 1.5) return true;
  }
  return false;
}

function hasWeakScenarioDescription(plan: SessionPlan) {
  const explanationLength = `${plan.entryZone} ${plan.note} ${plan.scenarioInvalidation}`.trim().length;
  return explanationLength < 25 || getScenarioArguments(plan).length < 2 || getScenarioTrades(plan).length > 0 && plan.closeComment?.trim().length === 0;
}

function isLateSession(facts: Array<{ plan: SessionPlan; trade: ScenarioTrade }>) {
  const lastFact = facts[facts.length - 1];
  if (!lastFact) return false;
  const timestamp = getTradeTime(lastFact.trade, lastFact.plan);
  if (!Number.isFinite(timestamp)) return false;
  return new Date(timestamp).getHours() >= 16;
}

function getTradeTime(trade: ScenarioTrade, plan: SessionPlan) {
  const parsed = Date.parse(trade.executedAt || plan.closedAt || plan.archivedAt || `${plan.planDate}T12:00:00`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
