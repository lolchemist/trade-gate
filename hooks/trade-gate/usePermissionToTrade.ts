import { useMemo } from "react";
import { calculatePermission, getBestValidScenario } from "@/components/trade-gate/utils";
import type { BehavioralRiskResult } from "@/hooks/trade-gate/useBehavioralRiskEngine";
import type { FTMORiskMetrics, GateResult, PermissionToTrade, TradingSessionStatus } from "@/types/trade-gate";

const LOADING_PERMISSION: PermissionToTrade = {
  permission: "denied",
  mode: "locked",
  maxAllowedRisk: 0,
  maxAllowedLot: 0,
  maxAdditionalTrades: 0,
  reEntryAllowed: false,
  instruction: "Проверяю сохранённое состояние. До завершения проверки торговля не разрешена.",
};

const CLOSED_DAY_PERMISSION: PermissionToTrade = {
  permission: "denied",
  mode: "locked",
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
  behavioralRisk?: BehavioralRiskResult;
  ftmoRisk?: FTMORiskMetrics;
  localSessionStatus?: TradingSessionStatus;
  allowAfterHoursTrading?: boolean;
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
  behavioralRisk,
  ftmoRisk,
  localSessionStatus,
  allowAfterHoursTrading,
}: UsePermissionToTradeInput): PermissionToTrade {
  return useMemo(() => {
    if (!isReady) return LOADING_PERMISSION;
    if (isTradingDayClosed) return CLOSED_DAY_PERMISSION;
    if (ftmoRisk?.ftmoDailyLossHit || ftmoRisk?.personalDailyStopHit || ftmoRisk?.maxLossBreached) {
      return {
        permission: "denied",
        mode: "locked",
        maxAllowedRisk: 0,
        maxAllowedLot: 0,
        maxAdditionalTrades: 0,
        reEntryAllowed: false,
        instruction: "FTMO/личный риск исчерпан. Новые сделки запрещены.",
      };
    }
    const scenarioRisk = Number(bestValidScenario?.plan.tradeRisk) || 0;
    const scenarioLot = bestValidScenario?.validation.math.lot ?? 0;
    const scaleLot = (allowedRisk: number) => (scenarioRisk > 0 && scenarioLot > 0 ? scenarioLot * (allowedRisk / scenarioRisk) : 0);
    const ftmoAllowedRisk = ftmoRisk ? Math.max(0, Math.min(ftmoRisk.remainingPersonalDailyRisk, ftmoRisk.remainingFtmoDailyRiskAfterBuffer)) : Number.POSITIVE_INFINITY;

    if (behavioralRisk?.state === "RED") {
      return {
        permission: "denied",
        mode: "locked",
        maxAllowedRisk: 0,
        maxAllowedLot: 0,
        maxAdditionalTrades: 0,
        reEntryAllowed: false,
        instruction: behavioralRisk.instruction,
      };
    }

    if (behavioralRisk?.state === "ORANGE") {
      return {
        permission: "denied",
        mode: "sim_only",
        maxAllowedRisk: 0,
        maxAllowedLot: 0,
        maxAdditionalTrades: 0,
        reEntryAllowed: false,
        instruction: behavioralRisk.instruction,
      };
    }

    if (behavioralRisk?.state === "YELLOW") {
      const maxAllowedRisk = Math.max(0, Math.min(dailyRiskRemaining, ftmoAllowedRisk, scenarioRisk || dailyRiskRemaining, behavioralRisk.maxAllowedRisk));
      return {
        permission: "reduced",
        mode: "reduced",
        maxAllowedRisk,
        maxAllowedLot: scaleLot(maxAllowedRisk),
        maxAdditionalTrades: 1,
        reEntryAllowed: false,
        instruction: behavioralRisk.instruction,
      };
    }

    if ((localSessionStatus === "post_session" || localSessionStatus === "closed") && !allowAfterHoursTrading) {
      return {
        permission: localSessionStatus === "closed" ? "denied" : "reduced",
        mode: localSessionStatus === "closed" ? "sim_only" : "reduced",
        maxAllowedRisk: localSessionStatus === "closed" ? 0 : Math.max(0, Math.min(dailyRiskRemaining, ftmoAllowedRisk, 25)),
        maxAllowedLot: localSessionStatus === "closed" ? 0 : scaleLot(Math.max(0, Math.min(dailyRiskRemaining, ftmoAllowedRisk, 25))),
        maxAdditionalTrades: localSessionStatus === "closed" ? 0 : 1,
        reEntryAllowed: false,
        instruction: localSessionStatus === "closed" ? "Сейчас не торговый день по локальной сессии. Только разбор или симуляция." : "Локальная сессия закончилась. Только сниженный риск, без re-entry.",
      };
    }

    return calculatePermission({
      status: isLocked ? "LOCKED" : riskResult.status,
      executionReadiness: riskResult.readiness.execution,
      emotionalReadiness: riskResult.readiness.emotional,
      disciplineReadiness: riskResult.readiness.discipline,
      dailyRiskRemaining: Math.min(dailyRiskRemaining, ftmoAllowedRisk),
      revengeDetectorScore: riskResult.revengeDetectorScore,
      personalDailyStopHit,
      tradesToday,
      consecutiveStops,
      bestScenarioRisk: scenarioRisk,
      bestScenarioLot: scenarioLot,
    });
  }, [isReady, isTradingDayClosed, isLocked, riskResult, dailyRiskRemaining, personalDailyStopHit, tradesToday, consecutiveStops, bestValidScenario, behavioralRisk, ftmoRisk, localSessionStatus, allowAfterHoursTrading]);
}
