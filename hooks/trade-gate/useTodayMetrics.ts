import { useMemo } from "react";
import { calculateActiveScenarioRisk, calculatePlannedRisk, getDailyRiskBudget, getExecutedScenarioTrades, isScenarioClosed } from "@/components/trade-gate/utils";
import { calculateConsecutiveStopCount, calculateDailyRiskUsage } from "@/lib/trade-gate/risk";
import type { AccountSettings, ArchivedPlan, DailyRiskBudget, ScenarioTrade, SessionPlan, TodayMetrics } from "@/types/trade-gate";

const executedStatuses = new Set<ScenarioTrade["status"]>(["executed", "take", "stop", "manual_profit", "manual_loss", "breakeven"]);

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
  const closedPlansForDate = activePlansForDate.filter(isScenarioClosed);
  const finalPlansForDate = activePlansForDate.filter((plan) => plan.status === "closed" || plan.status === "cancelled" || plan.status === "no_entry");
  const closedExecutedTrades = closedPlansForDate.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ trade, plan, archivedAt: trade.executedAt || plan.closedAt || "", planId: plan.id })));
  const archivedExecutedTrades = archivedForDate.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ trade, plan, archivedAt: trade.executedAt || plan.archivedAt, planId: plan.id })));
  const executedTrades = [...closedExecutedTrades, ...archivedExecutedTrades].filter((item) => executedStatuses.has(item.trade.status));
  const dailyRiskBudget = getDailyRiskBudget(dailyRiskBudgets, activePlanDate);
  const budget = Number(dailyRiskBudget.budgetUsd) || 0;
  const plannedRiskUsed = calculatePlannedRisk(sessionPlans, activePlanDate);
  const realizedPnl = executedTrades.reduce((total, item) => total + (Number(item.trade.actualResult) || 0), 0);
  const realizedLossUsed = executedTrades.reduce((total, item) => {
    const result = Number(item.trade.actualResult) || 0;
    return result < 0 ? total + Math.abs(result) : total;
  }, 0);
  const activeRiskExposureUsed = activePlansForDate
    .filter((plan) => plan.status === "active")
    .reduce((total, plan) => total + calculateActiveScenarioRisk(plan), 0);
  const personalDailyStop = Number(accountSettings.personalDailyStop) || 0;
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;
  const personalMaxLoss = Number(accountSettings.personalMaxLoss) || 0;
  const maxLossLimit = Number(accountSettings.maxLossLimit) || 0;
  const effectiveMaxLoss = personalMaxLoss > 0 ? Math.min(personalMaxLoss, maxLossLimit || personalMaxLoss) : maxLossLimit;
  const dailyRiskUsage = calculateDailyRiskUsage({
    maxDailyLossUsd: budget,
    closedPnlUsd: realizedPnl,
    activeRiskUsd: activeRiskExposureUsed,
  });
  const personalDailyRiskUsage = calculateDailyRiskUsage({
    maxDailyLossUsd: personalDailyStop,
    closedPnlUsd: realizedPnl,
    activeRiskUsd: activeRiskExposureUsed,
  });
  const propDailyRiskUsage = calculateDailyRiskUsage({
    maxDailyLossUsd: propDailyLossLimit,
    closedPnlUsd: realizedPnl,
    activeRiskUsd: activeRiskExposureUsed,
  });
  const riskUsedTotal = dailyRiskUsage.usedRiskUsd;
  const remainingRisk = dailyRiskUsage.remainingRiskUsd;

  return {
    planDate: activePlanDate,
    dailyRiskBudget,
    activeScenarioCount: activePlansForDate.length,
    plannedRiskUsed,
    activeRiskExposureUsed,
    realizedPnl,
    realizedLossUsed,
    riskUsedTotal,
    remainingRisk,
    dailyPnlForRiskStatus: realizedPnl,
    dailyLossForRiskStatus: -realizedLossUsed,
    personalDailyStopHit: personalDailyStop > 0 && personalDailyRiskUsage.remainingRiskUsd <= 0,
    propDailyLossClose: propDailyLossLimit > 0 && propDailyRiskUsage.remainingRiskUsd <= propDailyLossLimit * 0.2,
    propDailyLossHit: propDailyLossLimit > 0 && propDailyRiskUsage.remainingRiskUsd <= 0,
    propDailyLossUsed: propDailyRiskUsage.usedRiskUsd,
    totalLossUsed: effectiveMaxLoss > 0 ? realizedLossUsed : realizedLossUsed,
    profitProgress: Math.max(0, realizedPnl),
    tradesToday: executedTrades.length,
    consecutiveStops: calculateConsecutiveStopCount(executedTrades),
    stopCount: executedTrades.filter((item) => item.trade.status === "stop").length,
    takeCount: executedTrades.filter((item) => item.trade.status === "take").length,
    manualCloseCount: executedTrades.filter((item) => item.trade.status === "manual_profit" || item.trade.status === "manual_loss" || item.trade.status === "breakeven").length,
    noEntryCount: [...finalPlansForDate, ...archivedForDate].filter((plan) => plan.status === "no_entry" || plan.resultStatus === "no_entry" || getExecutedScenarioTrades(plan).length === 0).length,
  };
}
