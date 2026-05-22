import { useMemo } from "react";
import { calculatePermission, getBestValidScenario } from "@/components/trade-gate/utils";
import type { GateResult, PermissionToTrade } from "@/types/trade-gate";

const LOADING_PERMISSION: PermissionToTrade = {
  permission: "denied",
  maxAllowedRisk: 0,
  maxAllowedLot: 0,
  maxAdditionalTrades: 0,
  reEntryAllowed: false,
  instruction: "Проверяю сохранённое состояние. До завершения проверки торговля не разрешена.",
};

const CLOSED_DAY_PERMISSION: PermissionToTrade = {
  permission: "denied",
  maxAllowedRisk: 0,
  maxAllowedLot: 0,
  maxAdditionalTrades: 0,
  reEntryAllowed: false,
  instruction: "Торговля на сегодня завершена.",
};

type UsePermissionToTradeInput = {
  isReady: boolean;
  isTradingDayClosed: boolean;
  isLocked: boolean;
  riskResult: GateResult;
  dailyRiskRemaining: number;
  personalDailyStopHit: boolean;
  tradesToday: number;
  consecutiveStops: number;
  bestValidScenario: ReturnType<typeof getBestValidScenario>;
};

export function usePermissionToTrade({
  isReady,
  isTradingDayClosed,
  isLocked,
  riskResult,
  dailyRiskRemaining,
  personalDailyStopHit,
  tradesToday,
  consecutiveStops,
  bestValidScenario,
}: UsePermissionToTradeInput): PermissionToTrade {
  return useMemo(() => {
    if (!isReady) return LOADING_PERMISSION;
    if (isTradingDayClosed) return CLOSED_DAY_PERMISSION;

    return calculatePermission({
      status: isLocked ? "LOCKED" : riskResult.status,
      executionReadiness: riskResult.readiness.execution,
      emotionalReadiness: riskResult.readiness.emotional,
      disciplineReadiness: riskResult.readiness.discipline,
      dailyRiskRemaining,
      revengeDetectorScore: riskResult.revengeDetectorScore,
      personalDailyStopHit,
      tradesToday,
      consecutiveStops,
      bestScenarioRisk: Number(bestValidScenario?.plan.tradeRisk) || 0,
      bestScenarioLot: bestValidScenario?.validation.math.lot ?? 0,
    });
  }, [isReady, isTradingDayClosed, isLocked, riskResult, dailyRiskRemaining, personalDailyStopHit, tradesToday, consecutiveStops, bestValidScenario]);
}
