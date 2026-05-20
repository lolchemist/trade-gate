import { useMemo } from "react";
import { calculateWeeklyReport, getWeekRange } from "@/components/trade-gate/utils";
import type { ArchivedPlan } from "@/types/trade-gate";

export function useWeeklyReport(archivedPlans: ArchivedPlan[], activePlanDate: string, emergencyNotes: Record<string, string>) {
  return useMemo(() => {
    const weeklyReport = calculateWeeklyReport(archivedPlans, activePlanDate);
    const analyticsStats = getAnalyticsStats(archivedPlans, activePlanDate, emergencyNotes);

    return { weeklyReport, analyticsStats };
  }, [archivedPlans, activePlanDate, emergencyNotes]);
}

function getAnalyticsStats(archivedPlans: ArchivedPlan[], activePlanDate: string, emergencyNotes: Record<string, string>) {
  const { weekStart, weekEnd } = getWeekRange(activePlanDate);
  const plans = archivedPlans.filter((plan) => plan.planDate >= weekStart && plan.planDate <= weekEnd && plan.resultStatus !== "not_taken");

  return {
    byInstrument: groupPnl(plans, (plan) => plan.symbol),
    bySetup: groupPnl(plans, (plan) => plan.setupName || "Сетап не выбран"),
    mistakeCount: plans.filter((plan) => plan.technical === "no").length,
    revengeNoteCount: Object.entries(emergencyNotes).filter(([date, note]) => date >= weekStart && date <= weekEnd && note.trim().length > 0).length,
  };
}

function groupPnl(plans: ArchivedPlan[], getLabel: (plan: ArchivedPlan) => string) {
  const totals = new Map<string, number>();

  for (const plan of plans) {
    const label = getLabel(plan);
    totals.set(label, (totals.get(label) ?? 0) + (Number(plan.finalResult) || 0));
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
