import { useMemo } from "react";
import { calculatePlannedRisk, calculateScenarioExecutionRisk, getDailyRiskBudget, getExecutedScenarioTrades, isScenarioClosed } from "@/components/trade-gate/utils";
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
  const activeExecutedTrades = activePlansForDate.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ trade, plan, archivedAt: trade.executedAt || plan.closedAt || "", planId: plan.id })));
  const archivedExecutedTrades = archivedForDate.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ trade, plan, archivedAt: trade.executedAt || plan.archivedAt, planId: plan.id })));
  const executedTrades = [...activeExecutedTrades, ...archivedExecutedTrades].filter((item) => executedStatuses.has(item.trade.status));
  const dailyRiskBudget = getDailyRiskBudget(dailyRiskBudgets, activePlanDate);
  const budget = Number(dailyRiskBudget.budgetUsd) || 0;
  const plannedRiskUsed = calculatePlannedRisk(sessionPlans, activePlanDate);
  const realizedPnl = executedTrades.reduce((total, item) => total + (Number(item.trade.actualResult) || 0), 0);
  const realizedLossUsed = executedTrades.reduce((total, item) => {
    const result = Number(item.trade.actualResult) || 0;
    return result < 0 ? total + Math.abs(result) : total;
  }, 0);
  const activeRiskExposureUsed = activeExecutedTrades.reduce((total, item) => {
    if (item.trade.status !== "executed") return total;
    const calculatedRisk = calculateScenarioExecutionRisk(item.plan, item.trade).risk;
    return total + Math.max(0, Number(item.trade.actualRisk) || calculatedRisk || 0);
  }, 0);
  const riskUsedTotal = realizedLossUsed + activeRiskExposureUsed;
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
    activeRiskExposureUsed,
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
    stopCount: executedTrades.filter((item) => item.trade.status === "stop").length,
    takeCount: executedTrades.filter((item) => item.trade.status === "take").length,
    manualCloseCount: executedTrades.filter((item) => item.trade.status === "manual_profit" || item.trade.status === "manual_loss" || item.trade.status === "breakeven").length,
    noEntryCount: [...closedPlansForDate, ...archivedForDate].filter((plan) => plan.resultStatus === "no_entry" || getExecutedScenarioTrades(plan).length === 0).length,
  };
}

function calculateConsecutiveStops(trades: { trade: ScenarioTrade; archivedAt: string; planId: number }[]) {
  const sorted = [...trades].sort((a, b) => getTradeOrder(a) - getTradeOrder(b) || a.planId - b.planId);
  let count = 0;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index].trade.status !== "stop") break;
    count += 1;
  }

  return count;
}

function getTradeOrder(item: { trade: ScenarioTrade; archivedAt: string; planId: number }) {
  const timestamp = Date.parse((item.archivedAt || item.trade.executedAt).replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : item.planId;
}
