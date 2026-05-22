import { useMemo } from "react";
import { calculatePlannedRisk, getDailyRiskBudget } from "@/components/trade-gate/utils";
import type { AccountSettings, ArchivedPlan, DailyRiskBudget, SessionPlan, TodayMetrics } from "@/types/trade-gate";

const executedStatuses = new Set<ArchivedPlan["resultStatus"]>(["take", "stop", "manual_profit", "manual_loss", "breakeven"]);

export function useTodayMetrics(
  activePlanDate: string,
  sessionPlans: SessionPlan[],
  archivedPlans: ArchivedPlan[],
  dailyRiskBudgets: Record<string, DailyRiskBudget>,
  accountSettings: AccountSettings
): TodayMetrics {
  return useMemo(
    () => calculateTodayMetrics(activePlanDate, sessionPlans, archivedPlans, dailyRiskBudgets, accountSettings),
    [activePlanDate, sessionPlans, archivedPlans, dailyRiskBudgets, accountSettings]
  );
}

function calculateTodayMetrics(
  activePlanDate: string,
  sessionPlans: SessionPlan[],
  archivedPlans: ArchivedPlan[],
  dailyRiskBudgets: Record<string, DailyRiskBudget>,
  accountSettings: AccountSettings
): TodayMetrics {
  const activePlansForDate = sessionPlans.filter((plan) => plan.planDate === activePlanDate);
  const archivedForDate = archivedPlans.filter((plan) => plan.planDate === activePlanDate);
  const executedTrades = archivedForDate.filter((plan) => executedStatuses.has(plan.resultStatus));
  const dailyRiskBudget = getDailyRiskBudget(dailyRiskBudgets, activePlanDate);
  const budget = Number(dailyRiskBudget.budgetUsd) || 0;
  const plannedRiskUsed = calculatePlannedRisk(sessionPlans, activePlanDate);
  const realizedPnl = archivedForDate.reduce((total, plan) => total + (Number(plan.finalResult) || 0), 0);
  const realizedLossUsed = archivedForDate.reduce((total, plan) => {
    const result = Number(plan.finalResult) || 0;
    return result < 0 ? total + Math.abs(result) : total;
  }, 0);
  const riskUsedTotal = plannedRiskUsed + realizedLossUsed;
  const remainingRisk = budget - riskUsedTotal;
  const personalDailyStop = Number(accountSettings.personalDailyStop) || 0;
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;
  const personalMaxLoss = Number(accountSettings.personalMaxLoss) || 0;
  const maxLossLimit = Number(accountSettings.maxLossLimit) || 0;
  const effectiveMaxLoss = personalMaxLoss > 0 ? Math.min(personalMaxLoss, maxLossLimit || personalMaxLoss) : maxLossLimit;

  return {
    planDate: activePlanDate,
    dailyRiskBudget,
    activeScenarioCount: activePlansForDate.length,
    plannedRiskUsed,
    realizedPnl,
    realizedLossUsed,
    riskUsedTotal,
    remainingRisk,
    dailyPnlForRiskStatus: realizedPnl,
    dailyLossForRiskStatus: -realizedLossUsed,
    personalDailyStopHit: personalDailyStop > 0 && realizedLossUsed >= personalDailyStop,
    propDailyLossClose: propDailyLossLimit > 0 && realizedLossUsed >= propDailyLossLimit * 0.8,
    propDailyLossHit: propDailyLossLimit > 0 && realizedLossUsed >= propDailyLossLimit,
    propDailyLossUsed: realizedLossUsed,
    totalLossUsed: effectiveMaxLoss > 0 ? realizedLossUsed : realizedLossUsed,
    profitProgress: Math.max(0, realizedPnl),
    tradesToday: executedTrades.length,
    consecutiveStops: calculateConsecutiveStops(executedTrades),
    stopCount: archivedForDate.filter((plan) => plan.resultStatus === "stop").length,
    takeCount: archivedForDate.filter((plan) => plan.resultStatus === "take").length,
    manualCloseCount: archivedForDate.filter((plan) => plan.resultStatus === "manual_profit" || plan.resultStatus === "manual_loss" || plan.resultStatus === "breakeven").length,
    noEntryCount: archivedForDate.filter((plan) => plan.resultStatus === "not_taken").length,
  };
}

function calculateConsecutiveStops(plans: ArchivedPlan[]) {
  const sorted = [...plans].sort((a, b) => getArchiveOrder(a) - getArchiveOrder(b) || a.id - b.id);
  let count = 0;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index].resultStatus !== "stop") break;
    count += 1;
  }

  return count;
}

function getArchiveOrder(plan: ArchivedPlan) {
  const timestamp = Date.parse(plan.archivedAt.replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : plan.id;
}
