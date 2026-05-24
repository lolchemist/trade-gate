import { useMemo } from "react";
import { DEFAULT_DAILY_RISK_BUDGET } from "@/constants/trade-gate";
import { calculateExecutionQuality } from "@/hooks/trade-gate/useExecutionQuality";
import { calculateScenarioQuality } from "@/hooks/trade-gate/useScenarioQuality";
import {
  calculateScenarioTradeMath,
  getExecutedScenarioTrades,
  getPlanEntryMethod,
  getScenarioArguments,
  getWeekRange,
} from "@/components/trade-gate/utils";
import type { AccountSettings, ArchivedPlan, DailyRiskBudget, RiskControlState, ScenarioTrade, TechnicalStatus } from "@/types/trade-gate";

export type AnalyticsTone = "emerald" | "amber" | "red" | "cyan" | "neutral";

export type AnalyticsFact = {
  plan: ArchivedPlan;
  trade: ScenarioTrade;
  planDate: string;
  instrument: string;
  entryMethod: string;
  pnl: number;
  isWin: boolean;
  isLoss: boolean;
  isStop: boolean;
  isTake: boolean;
  isManualClose: boolean;
  technical: TechnicalStatus;
  plannedRisk: number;
  actualRisk: number;
  plannedRr: number;
  actualRr: number;
  scenarioQuality: number;
  executionQuality: number;
  argumentCount: number;
  anxiety: number;
  urge: number;
  anger: number;
  revengeFlag: boolean;
  executedAt: string;
  executionHour?: number;
};

export type AnalyticsGroup = {
  label: string;
  tradeCount: number;
  scenarioCount: number;
  pnl: number;
  wins: number;
  losses: number;
  winrate: number;
  expectancy: number;
  averageRr: number;
  averagePlannedRr: number;
  averageActualRr: number;
  technicalPercentage: number;
  averageRisk: number;
  averageExecutionQuality: number;
  averageScenarioQuality: number;
};

export type AnalyticsInsight = {
  title: string;
  value: string;
  detail: string;
  tone: AnalyticsTone;
};

export type AnalyticsOverview = {
  netPnl: number;
  tradeCount: number;
  scenarioCount: number;
  technicalPercentage: number;
  averagePlannedRr: number;
  averageActualRr: number;
  disciplineScore: number;
  averageRevengeRisk: number;
  averageExecutionQuality: number;
  averageScenarioQuality: number;
};

export type AnalyticsReport = {
  hasEnoughData: boolean;
  facts: AnalyticsFact[];
  overview: AnalyticsOverview;
  insightSummary: {
    positives: string[];
    warnings: string[];
    focus: string;
  };
  whatWorks: AnalyticsInsight[];
  whatHurts: AnalyticsInsight[];
  behavior: {
    revengeFrequency: number;
    revengePnl: number;
    nonRevengePnl: number;
    anxietyBuckets: AnalyticsGroup[];
    urgeBuckets: AnalyticsGroup[];
    angerBuckets: AnalyticsGroup[];
    afterLoss: AnalyticsGroup[];
    stopStreakLoss: number;
  };
  execution: {
    technicalPnl: number;
    nonTechnicalPnl: number;
    partialTechnicalPnl: number;
    averageRiskDeviation: number;
    plannedVsActualRrDeviation: number;
    manualCloseCount: number;
    planViolationCount: number;
  };
  groups: {
    byInstrument: AnalyticsGroup[];
    byEntryMethod: AnalyticsGroup[];
    byScenarioQuality: AnalyticsGroup[];
    byExecutionQuality: AnalyticsGroup[];
    byPlannedRr: AnalyticsGroup[];
    byTradesPerDay: AnalyticsGroup[];
    byScenarioArgument: AnalyticsGroup[];
    byArgumentCombination: AnalyticsGroup[];
  };
  risk: {
    averageRiskPerTrade: number;
    biggestRiskDeviation: number;
    riskBudgetExceededDays: number;
    disciplinedDayPnl: number;
    violatedDayPnl: number;
    personalDailyStopHits: number;
    propDangerEvents: number;
  };
  weekly: {
    weekStart: string;
    weekEnd: string;
    netPnl: number;
    trades: number;
    scenarios: number;
    technicalPercentage: number;
    bestInstrument: string;
    worstInstrument: string;
    bestEntryMethod: string;
    worstEntryMethod: string;
    biggestMistake: string;
    bestBehavior: string;
    repeatNextWeek: string;
    avoidNextWeek: string;
  };
};

export function useAnalytics({
  archivedPlans,
  activePlanDate,
  riskControlsByDate,
  dailyRiskBudgets,
  accountSettings,
  emergencyNotes,
}: {
  archivedPlans: ArchivedPlan[];
  activePlanDate: string;
  riskControlsByDate: Record<string, RiskControlState>;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
}): AnalyticsReport {
  return useMemo(
    () =>
      buildAnalyticsReport({
        archivedPlans,
        activePlanDate,
        riskControlsByDate,
        dailyRiskBudgets,
        accountSettings,
        emergencyNotes,
      }),
    [archivedPlans, activePlanDate, riskControlsByDate, dailyRiskBudgets, accountSettings, emergencyNotes]
  );
}

export function usePerformanceInsights(facts: AnalyticsFact[]) {
  return useMemo(() => {
    const byInstrument = groupFacts(facts, (fact) => fact.instrument);
    const byEntryMethod = groupFacts(facts, (fact) => fact.entryMethod);
    const byScenarioQuality = groupFacts(facts, (fact) => qualityBucket(fact.scenarioQuality));
    const byExecutionQuality = groupFacts(facts, (fact) => qualityBucket(fact.executionQuality));
    const byPlannedRr = groupFacts(facts, (fact) => rrBucket(fact.plannedRr));
    const dayTradeCounts = new Map<string, number>();
    for (const fact of facts) dayTradeCounts.set(fact.planDate, (dayTradeCounts.get(fact.planDate) ?? 0) + 1);
    const byTradesPerDay = groupFacts(facts, (fact) => tradesPerDayBucket(dayTradeCounts.get(fact.planDate) ?? 0));

    return {
      byInstrument,
      byEntryMethod,
      byScenarioQuality,
      byExecutionQuality,
      byPlannedRr,
      byTradesPerDay,
      whatWorks: buildWhatWorks({ byInstrument, byEntryMethod, byScenarioQuality, byExecutionQuality, byPlannedRr, byTradesPerDay }),
    };
  }, [facts]);
}

export function useBehavioralInsights(facts: AnalyticsFact[]) {
  return useMemo(() => buildBehavioralInsights(facts), [facts]);
}

function buildAnalyticsReport({
  archivedPlans,
  activePlanDate,
  riskControlsByDate,
  dailyRiskBudgets,
  accountSettings,
  emergencyNotes,
}: {
  archivedPlans: ArchivedPlan[];
  activePlanDate: string;
  riskControlsByDate: Record<string, RiskControlState>;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
}): AnalyticsReport {
  const facts = archivedPlans.flatMap((plan) => toAnalyticsFacts(plan, riskControlsByDate, emergencyNotes));
  const scenarioCount = archivedPlans.length;
  const overview = buildOverview(facts, scenarioCount);
  const byInstrument = groupFacts(facts, (fact) => fact.instrument);
  const byEntryMethod = groupFacts(facts, (fact) => fact.entryMethod);
  const byScenarioQuality = groupFacts(facts, (fact) => qualityBucket(fact.scenarioQuality));
  const byExecutionQuality = groupFacts(facts, (fact) => qualityBucket(fact.executionQuality));
  const byPlannedRr = groupFacts(facts, (fact) => rrBucket(fact.plannedRr));
  const byScenarioArgument = groupFactsByLabels(facts, (fact) => getScenarioArguments(fact.plan));
  const byArgumentCombination = groupFacts(facts, (fact) => {
    const argumentsLabel = getScenarioArguments(fact.plan).sort((a, b) => a.localeCompare(b, "ru")).join(" + ");
    return argumentsLabel || "Аргументы не указаны";
  });
  const dayTradeCounts = new Map<string, number>();
  for (const fact of facts) dayTradeCounts.set(fact.planDate, (dayTradeCounts.get(fact.planDate) ?? 0) + 1);
  const byTradesPerDay = groupFacts(facts, (fact) => tradesPerDayBucket(dayTradeCounts.get(fact.planDate) ?? 0));
  const behavior = buildBehavioralInsights(facts);
  const execution = buildExecutionInsights(facts);
  const risk = buildRiskDiscipline(archivedPlans, facts, dailyRiskBudgets, accountSettings);
  const whatWorks = buildWhatWorks({ byInstrument, byEntryMethod, byScenarioQuality, byExecutionQuality, byPlannedRr, byTradesPerDay });
  const whatHurts = buildWhatHurts({ byInstrument, byEntryMethod, byScenarioQuality, byExecutionQuality, byPlannedRr, behavior, risk });
  const weekly = buildWeeklyInsight(activePlanDate, archivedPlans, facts);
  const insightSummary = buildInsightSummary(whatWorks, whatHurts, weekly, overview.tradeCount);

  return {
    hasEnoughData: facts.length >= 10,
    facts,
    overview,
    insightSummary,
    whatWorks,
    whatHurts,
    behavior,
    execution,
    groups: {
      byInstrument,
      byEntryMethod,
      byScenarioQuality,
      byExecutionQuality,
      byPlannedRr,
      byTradesPerDay,
      byScenarioArgument,
      byArgumentCombination,
    },
    risk,
    weekly,
  };
}

function toAnalyticsFacts(plan: ArchivedPlan, riskControlsByDate: Record<string, RiskControlState>, emergencyNotes: Record<string, string>): AnalyticsFact[] {
  const plannedMath = calculateScenarioTradeMath(plan);
  const scenarioQuality = calculateScenarioQuality(plan, Boolean(plan.chartImage)).score;
  const riskControls = riskControlsByDate[plan.planDate];
  const entryMethod = getPlanEntryMethod(plan) || "Способ не выбран";
  const revengeFlag = Boolean(riskControls?.revenge || emergencyNotes[plan.planDate]?.trim());

  return getExecutedScenarioTrades(plan).map((trade) => {
    const pnl = Number(trade.actualResult) || 0;
    const executionQuality = calculateExecutionQuality(plan, trade).score;
    const executedAt = trade.executedAt || plan.closedAt || plan.archivedAt || "";
    const parsedDate = Date.parse(executedAt);
    const executionHour = Number.isFinite(parsedDate) ? new Date(parsedDate).getHours() : undefined;
    const actualRisk = Number(trade.actualRisk) || Number(plan.tradeRisk) || 0;
    const actualRr = Number(trade.actualRr) || (actualRisk > 0 ? Number((pnl / actualRisk).toFixed(2)) : 0);

    return {
      plan,
      trade,
      planDate: plan.planDate,
      instrument: plan.symbol,
      entryMethod,
      pnl,
      isWin: pnl > 0,
      isLoss: pnl < 0,
      isStop: trade.status === "stop",
      isTake: trade.status === "take",
      isManualClose: trade.status === "manual_profit" || trade.status === "manual_loss" || trade.status === "breakeven",
      technical: trade.technical,
      plannedRisk: Number(plan.tradeRisk) || 0,
      actualRisk,
      plannedRr: plannedMath.rr,
      actualRr,
      scenarioQuality,
      executionQuality,
      argumentCount: getScenarioArguments(plan).length,
      anxiety: Number(riskControls?.anxiety) || 0,
      urge: Number(riskControls?.urge) || 0,
      anger: Number(riskControls?.anger) || 0,
      revengeFlag,
      executedAt,
      executionHour,
    };
  });
}

function buildOverview(facts: AnalyticsFact[], scenarioCount: number): AnalyticsOverview {
  const technicalCount = facts.filter((fact) => fact.technical === "yes").length;
  const revengeCount = facts.filter((fact) => fact.revengeFlag).length;
  const executionQuality = average(facts.map((fact) => fact.executionQuality));
  const scenarioQuality = average(facts.map((fact) => fact.scenarioQuality));

  return {
    netPnl: sum(facts.map((fact) => fact.pnl)),
    tradeCount: facts.length,
    scenarioCount,
    technicalPercentage: percent(technicalCount, facts.length),
    averagePlannedRr: average(facts.map((fact) => fact.plannedRr).filter((value) => value > 0)),
    averageActualRr: average(facts.map((fact) => fact.actualRr).filter((value) => value !== 0)),
    disciplineScore: Math.round((executionQuality + scenarioQuality) / 2) || 0,
    averageRevengeRisk: percent(revengeCount, facts.length),
    averageExecutionQuality: executionQuality,
    averageScenarioQuality: scenarioQuality,
  };
}

function buildBehavioralInsights(facts: AnalyticsFact[]) {
  const revengeFacts = facts.filter((fact) => fact.revengeFlag);
  const nonRevengeFacts = facts.filter((fact) => !fact.revengeFlag);
  const ordered = [...facts].sort((a, b) => getFactTime(a) - getFactTime(b));
  const afterLossFacts = ordered.filter((fact, index) => index > 0 && ordered[index - 1].planDate === fact.planDate && ordered[index - 1].pnl < 0);
  const afterStopFacts = ordered.filter((fact, index) => index > 0 && ordered[index - 1].planDate === fact.planDate && ordered[index - 1].isStop);

  return {
    revengeFrequency: percent(revengeFacts.length, facts.length),
    revengePnl: sum(revengeFacts.map((fact) => fact.pnl)),
    nonRevengePnl: sum(nonRevengeFacts.map((fact) => fact.pnl)),
    anxietyBuckets: groupFacts(facts.filter((fact) => fact.anxiety > 0), (fact) => emotionBucket(fact.anxiety)),
    urgeBuckets: groupFacts(facts.filter((fact) => fact.urge > 0), (fact) => emotionBucket(fact.urge)),
    angerBuckets: groupFacts(facts.filter((fact) => fact.anger > 0), (fact) => emotionBucket(fact.anger)),
    afterLoss: groupFacts(afterLossFacts, () => "После убыточной сделки"),
    stopStreakLoss: sum(afterStopFacts.map((fact) => fact.pnl)),
  };
}

function buildExecutionInsights(facts: AnalyticsFact[]) {
  const technicalFacts = facts.filter((fact) => fact.technical === "yes");
  const partialFacts = facts.filter((fact) => fact.technical === "partial");
  const nonTechnicalFacts = facts.filter((fact) => fact.technical === "no");
  const riskDeviations = facts
    .filter((fact) => fact.plannedRisk > 0 && fact.actualRisk > 0)
    .map((fact) => ((fact.actualRisk - fact.plannedRisk) / fact.plannedRisk) * 100);
  const rrDeviations = facts
    .filter((fact) => fact.plannedRr > 0 && fact.actualRr !== 0)
    .map((fact) => fact.actualRr - fact.plannedRr);

  return {
    technicalPnl: sum(technicalFacts.map((fact) => fact.pnl)),
    nonTechnicalPnl: sum(nonTechnicalFacts.map((fact) => fact.pnl)),
    partialTechnicalPnl: sum(partialFacts.map((fact) => fact.pnl)),
    averageRiskDeviation: average(riskDeviations),
    plannedVsActualRrDeviation: average(rrDeviations),
    manualCloseCount: facts.filter((fact) => fact.isManualClose).length,
    planViolationCount: facts.filter((fact) => fact.technical === "no" || fact.executionQuality < 55).length,
  };
}

function buildRiskDiscipline(
  archivedPlans: ArchivedPlan[],
  facts: AnalyticsFact[],
  dailyRiskBudgets: Record<string, DailyRiskBudget>,
  accountSettings: AccountSettings
) {
  const factsByDate = new Map<string, AnalyticsFact[]>();
  for (const fact of facts) {
    const dayFacts = factsByDate.get(fact.planDate) ?? [];
    dayFacts.push(fact);
    factsByDate.set(fact.planDate, dayFacts);
  }

  let riskBudgetExceededDays = 0;
  let disciplinedDayPnl = 0;
  let violatedDayPnl = 0;
  let personalDailyStopHits = 0;
  let propDangerEvents = 0;
  const personalDailyStop = Number(accountSettings.personalDailyStop) || 0;
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;

  for (const [planDate, dayFacts] of factsByDate.entries()) {
    const budget = Number(dailyRiskBudgets[planDate]?.budgetUsd) || Number(DEFAULT_DAILY_RISK_BUDGET);
    const realizedLoss = Math.abs(sum(dayFacts.filter((fact) => fact.pnl < 0).map((fact) => fact.pnl)));
    const dayPnl = sum(dayFacts.map((fact) => fact.pnl));
    const exceeded = realizedLoss > budget;
    if (exceeded) {
      riskBudgetExceededDays += 1;
      violatedDayPnl += dayPnl;
    } else {
      disciplinedDayPnl += dayPnl;
    }
    if (personalDailyStop > 0 && realizedLoss >= personalDailyStop) personalDailyStopHits += 1;
    if (propDailyLossLimit > 0 && realizedLoss >= propDailyLossLimit * 0.8) propDangerEvents += 1;
  }

  const riskDeviations = facts
    .filter((fact) => fact.plannedRisk > 0 && fact.actualRisk > 0)
    .map((fact) => Math.abs(((fact.actualRisk - fact.plannedRisk) / fact.plannedRisk) * 100));

  return {
    averageRiskPerTrade: average(facts.map((fact) => fact.actualRisk || fact.plannedRisk).filter((value) => value > 0)),
    biggestRiskDeviation: riskDeviations.length > 0 ? Math.max(...riskDeviations) : 0,
    riskBudgetExceededDays,
    disciplinedDayPnl,
    violatedDayPnl,
    personalDailyStopHits,
    propDangerEvents,
  };
}

function buildWhatWorks(groups: {
  byInstrument: AnalyticsGroup[];
  byEntryMethod: AnalyticsGroup[];
  byScenarioQuality: AnalyticsGroup[];
  byExecutionQuality: AnalyticsGroup[];
  byPlannedRr: AnalyticsGroup[];
  byTradesPerDay: AnalyticsGroup[];
}): AnalyticsInsight[] {
  return [
    insightFromGroup("Лучший инструмент", bestByExpectancy(groups.byInstrument), "где результат устойчивее всего", "emerald"),
    insightFromGroup("Лучший способ входа", bestByExpectancy(groups.byEntryMethod), "какой вход даёт лучший expectancy", "cyan"),
    insightFromGroup("Лучшее качество сценария", bestByExpectancy(groups.byScenarioQuality), "какой уровень подготовки приносит деньги", "emerald"),
    insightFromGroup("Лучшее исполнение", bestByExpectancy(groups.byExecutionQuality), "где хорошее исполнение отделено от случайного результата", "emerald"),
    insightFromGroup("Лучший RR-бакет", bestByExpectancy(groups.byPlannedRr), "какой плановый RR работает лучше", "cyan"),
    insightFromGroup("Оптимум сделок в день", bestByExpectancy(groups.byTradesPerDay), "сколько попыток не разрушает результат", "amber"),
  ].filter(Boolean) as AnalyticsInsight[];
}

function buildWhatHurts(groups: {
  byInstrument: AnalyticsGroup[];
  byEntryMethod: AnalyticsGroup[];
  byScenarioQuality: AnalyticsGroup[];
  byExecutionQuality: AnalyticsGroup[];
  byPlannedRr: AnalyticsGroup[];
  behavior: ReturnType<typeof buildBehavioralInsights>;
  risk: ReturnType<typeof buildRiskDiscipline>;
}): AnalyticsInsight[] {
  const lowScenario = groups.byScenarioQuality.find((group) => group.label.startsWith("0–40"));
  const lowExecution = groups.byExecutionQuality.find((group) => group.label.startsWith("0–40"));
  const lowRr = groups.byPlannedRr.find((group) => group.label.includes("< 1:3"));
  const insights: AnalyticsInsight[] = [
    insightFromGroup("Худший инструмент", worstByExpectancy(groups.byInstrument), "где матожидание слабее всего", "red"),
    insightFromGroup("Худший способ входа", worstByExpectancy(groups.byEntryMethod), "какой вход чаще забирает PnL", "red"),
  ].filter(Boolean) as AnalyticsInsight[];

  if (lowScenario && lowScenario.tradeCount > 0) insights.push(groupInsight("Низкое качество сценария", lowScenario, "слабые сценарии тянут результат вниз", "amber"));
  if (lowExecution && lowExecution.tradeCount > 0) insights.push(groupInsight("Слабое исполнение", lowExecution, "проблема может быть не в идее, а в реализации", "red"));
  if (lowRr && lowRr.tradeCount > 0) insights.push(groupInsight("Низкий RR", lowRr, "сделки ниже 1:3 портят профиль риска", "amber"));
  if (groups.behavior.revengePnl < 0) {
    insights.push({
      title: "Revenge-режим",
      value: formatSigned(groups.behavior.revengePnl),
      detail: "сделки в дни с revenge-флагом имеют отрицательный вклад",
      tone: "red",
    });
  }
  if (groups.risk.riskBudgetExceededDays > 0) {
    insights.push({
      title: "Нарушение риск-бюджета",
      value: `${groups.risk.riskBudgetExceededDays} дн.`,
      detail: "дни с превышением риска требуют отдельного разбора",
      tone: "red",
    });
  }

  return insights;
}

function buildWeeklyInsight(activePlanDate: string, archivedPlans: ArchivedPlan[], allFacts: AnalyticsFact[]) {
  const { weekStart, weekEnd } = getWeekRange(activePlanDate);
  const weekPlans = archivedPlans.filter((plan) => plan.planDate >= weekStart && plan.planDate <= weekEnd);
  const weekFacts = allFacts.filter((fact) => fact.planDate >= weekStart && fact.planDate <= weekEnd);
  const byInstrument = groupFacts(weekFacts, (fact) => fact.instrument);
  const byEntryMethod = groupFacts(weekFacts, (fact) => fact.entryMethod);
  const technicalPercentage = percent(weekFacts.filter((fact) => fact.technical === "yes").length, weekFacts.length);
  const bestInstrument = bestByExpectancy(byInstrument);
  const worstInstrument = worstByExpectancy(byInstrument);
  const bestEntryMethod = bestByExpectancy(byEntryMethod);
  const worstEntryMethod = worstByExpectancy(byEntryMethod);
  const worstFact = [...weekFacts].sort((a, b) => a.pnl - b.pnl)[0];
  const bestBehavior = groupFacts(weekFacts, (fact) => qualityBucket(fact.executionQuality))[0];

  return {
    weekStart,
    weekEnd,
    netPnl: sum(weekFacts.map((fact) => fact.pnl)),
    trades: weekFacts.length,
    scenarios: weekPlans.length,
    technicalPercentage,
    bestInstrument: bestInstrument?.label ?? "—",
    worstInstrument: worstInstrument?.label ?? "—",
    bestEntryMethod: bestEntryMethod?.label ?? "—",
    worstEntryMethod: worstEntryMethod?.label ?? "—",
    biggestMistake: worstFact ? `${worstFact.instrument} · ${worstFact.entryMethod} · ${formatSigned(worstFact.pnl)}` : "Недостаточно данных",
    bestBehavior: bestBehavior ? `${bestBehavior.label}: ${bestBehavior.technicalPercentage}% техничность` : "Недостаточно данных",
    repeatNextWeek: bestEntryMethod ? `Повторять: ${bestEntryMethod.label} только при RR >= 1:3 и нормальном риске.` : "Сначала накопить больше архивных сделок.",
    avoidNextWeek: worstEntryMethod ? `Избегать: ${worstEntryMethod.label} без идеального исполнения и контроля риска.` : "Не торговать без полного сценария.",
  };
}

function buildInsightSummary(works: AnalyticsInsight[], hurts: AnalyticsInsight[], weekly: AnalyticsReport["weekly"], tradeCount: number) {
  const positives = works.slice(0, 3).map((insight) => `${insight.title}: ${insight.value}`);
  const warnings = hurts.slice(0, 3).map((insight) => `${insight.title}: ${insight.value}`);
  const focus =
    tradeCount < 10
      ? "Фокус недели: собрать 10+ исполненных сделок в архиве, чтобы expectancy стал надёжнее."
      : weekly.bestEntryMethod !== "—" && weekly.bestInstrument !== "—"
        ? `Фокус недели: торговать ${weekly.bestEntryMethod} на ${weekly.bestInstrument} только при RR >= 1:3.`
        : "Фокус недели: меньше сделок, выше качество сценария, строгий риск.";

  return {
    positives: positives.length > 0 ? positives : ["Пока нет устойчивых положительных паттернов."],
    warnings: warnings.length > 0 ? warnings : ["Критичных поведенческих провалов пока не видно."],
    focus,
  };
}

function groupFacts(facts: AnalyticsFact[], getLabel: (fact: AnalyticsFact) => string): AnalyticsGroup[] {
  const groups = new Map<string, AnalyticsFact[]>();
  for (const fact of facts) {
    const label = getLabel(fact) || "Не указано";
    const current = groups.get(label) ?? [];
    current.push(fact);
    groups.set(label, current);
  }
  return [...groups.entries()].map(([label, groupFacts]) => toGroup(label, groupFacts)).sort((a, b) => b.pnl - a.pnl);
}

function groupFactsByLabels(facts: AnalyticsFact[], getLabels: (fact: AnalyticsFact) => string[]): AnalyticsGroup[] {
  const groups = new Map<string, AnalyticsFact[]>();
  for (const fact of facts) {
    const labels = getLabels(fact);
    const safeLabels = labels.length > 0 ? labels : ["Не указано"];
    for (const label of safeLabels) {
      const current = groups.get(label) ?? [];
      current.push(fact);
      groups.set(label, current);
    }
  }
  return [...groups.entries()].map(([label, groupFacts]) => toGroup(label, groupFacts)).sort((a, b) => b.pnl - a.pnl);
}

function toGroup(label: string, facts: AnalyticsFact[]): AnalyticsGroup {
  const pnl = sum(facts.map((fact) => fact.pnl));
  const wins = facts.filter((fact) => fact.pnl > 0).length;
  const losses = facts.filter((fact) => fact.pnl < 0).length;
  return {
    label,
    tradeCount: facts.length,
    scenarioCount: new Set(facts.map((fact) => fact.plan.id)).size,
    pnl,
    wins,
    losses,
    winrate: percent(wins, facts.length),
    expectancy: facts.length > 0 ? Number((pnl / facts.length).toFixed(2)) : 0,
    averageRr: average(facts.map((fact) => fact.actualRr).filter((value) => value !== 0)),
    averagePlannedRr: average(facts.map((fact) => fact.plannedRr).filter((value) => value > 0)),
    averageActualRr: average(facts.map((fact) => fact.actualRr).filter((value) => value !== 0)),
    technicalPercentage: percent(facts.filter((fact) => fact.technical === "yes").length, facts.length),
    averageRisk: average(facts.map((fact) => fact.actualRisk || fact.plannedRisk).filter((value) => value > 0)),
    averageExecutionQuality: average(facts.map((fact) => fact.executionQuality)),
    averageScenarioQuality: average(facts.map((fact) => fact.scenarioQuality)),
  };
}

function bestByExpectancy(groups: AnalyticsGroup[]) {
  return [...groups].filter((group) => group.tradeCount > 0).sort((a, b) => b.expectancy - a.expectancy || b.pnl - a.pnl)[0];
}

function worstByExpectancy(groups: AnalyticsGroup[]) {
  return [...groups].filter((group) => group.tradeCount > 0).sort((a, b) => a.expectancy - b.expectancy || a.pnl - b.pnl)[0];
}

function insightFromGroup(title: string, group: AnalyticsGroup | undefined, detail: string, tone: AnalyticsTone) {
  if (!group) return null;
  return groupInsight(title, group, detail, tone);
}

function groupInsight(title: string, group: AnalyticsGroup, detail: string, tone: AnalyticsTone): AnalyticsInsight {
  return {
    title,
    value: group.label,
    detail: `${detail}. Expectancy ${formatSigned(group.expectancy)} · PnL ${formatSigned(group.pnl)} · ${group.tradeCount} сделок`,
    tone,
  };
}

function qualityBucket(score: number) {
  if (score <= 40) return "0–40 · слабое";
  if (score <= 70) return "41–70 · среднее";
  return "71–100 · сильное";
}

function rrBucket(rr: number) {
  if (rr <= 0) return "RR не рассчитан";
  if (rr < 3) return "< 1:3";
  if (rr < 5) return "1:3–1:5";
  return "1:5+";
}

function tradesPerDayBucket(count: number) {
  if (count <= 1) return "1 сделка/день";
  if (count <= 2) return "2 сделки/день";
  if (count <= 4) return "3–4 сделки/день";
  return "5+ сделок/день";
}

function emotionBucket(value: number) {
  if (value <= 3) return "0–3 · спокойно";
  if (value <= 6) return "4–6 · напряжение";
  return "7–10 · высокий риск";
}

function getFactTime(fact: AnalyticsFact) {
  const parsed = Date.parse(fact.executedAt);
  return Number.isFinite(parsed) ? parsed : Date.parse(`${fact.planDate}T12:00:00`);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function average(values: number[]) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length === 0) return 0;
  return Number((sum(safeValues) / safeValues.length).toFixed(2));
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatSigned(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : "-"}$${Math.abs(rounded)}`;
}
