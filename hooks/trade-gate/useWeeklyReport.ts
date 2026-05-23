import { useMemo } from "react";
import { calculateWeeklyReport, getExecutedScenarioTrades, getPlanArgumentNames, getPlanEntryMethod, getWeekRange } from "@/components/trade-gate/utils";
import type { ArchivedPlan, ScenarioTrade } from "@/types/trade-gate";

export function useWeeklyReport(archivedPlans: ArchivedPlan[], activePlanDate: string, emergencyNotes: Record<string, string>) {
  return useMemo(() => {
    const weeklyReport = calculateWeeklyReport(archivedPlans, activePlanDate);
    const analyticsStats = getAnalyticsStats(archivedPlans, activePlanDate, emergencyNotes);

    return { weeklyReport, analyticsStats };
  }, [archivedPlans, activePlanDate, emergencyNotes]);
}

function getAnalyticsStats(archivedPlans: ArchivedPlan[], activePlanDate: string, emergencyNotes: Record<string, string>) {
  const { weekStart, weekEnd } = getWeekRange(activePlanDate);
  const plans = archivedPlans.filter((plan) => plan.planDate >= weekStart && plan.planDate <= weekEnd);
  const tradeFacts = plans.flatMap((plan) => getExecutedScenarioTrades(plan).map((trade) => ({ plan, trade })));

  return {
    byInstrument: groupTradePnl(tradeFacts, (item) => item.plan.symbol),
    byArgument: groupTradePnlByLabels(tradeFacts, (item) => getPlanArgumentNames(item.plan)),
    byEntryType: groupTradePnl(tradeFacts, (item) => getPlanEntryMethod(item.plan) || "Способ не выбран"),
    mistakeCount: tradeFacts.filter((item) => item.trade.technical === "no").length,
    revengeNoteCount: Object.entries(emergencyNotes).filter(([date, note]) => date >= weekStart && date <= weekEnd && note.trim().length > 0).length,
  };
}

type TradeFact = { plan: ArchivedPlan; trade: ScenarioTrade };

function groupTradePnl(trades: TradeFact[], getLabel: (item: TradeFact) => string) {
  const totals = new Map<string, number>();

  for (const item of trades) {
    const label = getLabel(item);
    totals.set(label, (totals.get(label) ?? 0) + (Number(item.trade.actualResult) || 0));
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function groupTradePnlByLabels(trades: TradeFact[], getLabels: (item: TradeFact) => string[]) {
  const totals = new Map<string, number>();

  for (const item of trades) {
    const labels = getLabels(item);
    const safeLabels = labels.length > 0 ? labels : ["Аргумент не выбран"];
    for (const label of safeLabels) {
      totals.set(label, (totals.get(label) ?? 0) + (Number(item.trade.actualResult) || 0));
    }
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
