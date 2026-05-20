import { useMemo } from "react";
import { LOSS_LIMIT } from "@/constants/trade-gate";
import type { GateResult, ReadinessScores, TradeCalculatorState, TradeMath } from "@/types/trade-gate";

type UseRiskStatusInput = {
  sleep: number;
  anxiety: number;
  urge: number;
  anger: number;
  dailyPnl: string | number;
  dailyLoss: string | number;
  consecutiveStops: string | number;
  lockUntil: string;
  tradesToday: string | number;
  plan: boolean;
  newsChecked: boolean;
  stopSet: boolean;
  revenge: boolean;
  tradeMath: TradeMath;
  calculator: TradeCalculatorState;
  sessionPlanReadyCount: number;
  activePlanDateLabel: string;
  personalDailyStopHit: boolean;
  dailyRiskRemaining: number;
  propDailyLossClose: boolean;
};

export function useRiskStatus(input: UseRiskStatusInput): GateResult {
  const {
    sleep,
    anxiety,
    urge,
    anger,
    dailyPnl,
    dailyLoss,
    consecutiveStops,
    lockUntil,
    tradesToday,
    plan,
    newsChecked,
    stopSet,
    revenge,
    tradeMath,
    calculator,
    sessionPlanReadyCount,
    activePlanDateLabel,
    personalDailyStopHit,
    dailyRiskRemaining,
    propDailyLossClose,
  } = input;

  return useMemo(
    () =>
      calculateRiskStatus({
        sleep,
        anxiety,
        urge,
        anger,
        dailyPnl,
        dailyLoss,
        consecutiveStops,
        lockUntil,
        tradesToday,
        plan,
        newsChecked,
        stopSet,
        revenge,
        tradeMath,
        calculator,
        sessionPlanReadyCount,
        activePlanDateLabel,
        personalDailyStopHit,
        dailyRiskRemaining,
        propDailyLossClose,
      }),
    [
      sleep,
      anxiety,
      urge,
      anger,
      dailyPnl,
      dailyLoss,
      consecutiveStops,
      lockUntil,
      tradesToday,
      plan,
      newsChecked,
      stopSet,
      revenge,
      tradeMath,
      calculator,
      sessionPlanReadyCount,
      activePlanDateLabel,
      personalDailyStopHit,
      dailyRiskRemaining,
      propDailyLossClose,
    ]
  );
}

function calculateRiskStatus({
  sleep,
  anxiety,
  urge,
  anger,
  dailyPnl,
  dailyLoss,
  consecutiveStops,
  lockUntil,
  tradesToday,
  plan,
  newsChecked,
  stopSet,
  revenge,
  tradeMath,
  calculator,
  sessionPlanReadyCount,
  activePlanDateLabel,
  personalDailyStopHit,
  dailyRiskRemaining,
  propDailyLossClose,
}: UseRiskStatusInput): GateResult {
  let riskScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const readiness: ReadinessScores = {
    execution: 100,
    emotional: 100,
    discipline: 100,
  };

  const now = new Date();
  const isLocked = Boolean(lockUntil && new Date(lockUntil) > now);
  const dailyPnlNumber = Number(dailyPnl);
  const dailyLossNumber = Number(dailyLoss);
  const stopsNumber = Number(consecutiveStops);
  const tradesTodayNumber = Number(tradesToday);

  if (isLocked) {
    riskScore += 100;
    readiness.execution = 0;
    readiness.emotional = 0;
    readiness.discipline = 0;
    reasons.push(`торговля заблокирована до ${formatTime(lockUntil)}`);
  }

  if (sleep < 6) {
    riskScore += 3;
    readiness.emotional -= 15;
    reasons.push("мало сна: ниже 6 часов");
  }

  if (anxiety >= 7) {
    riskScore += 3;
    readiness.emotional -= 20;
    reasons.push("высокая тревога: 7/10 или выше");
  }

  if (urge >= 7) {
    riskScore += 4;
    readiness.emotional -= 25;
    reasons.push("сильное желание срочно торговать: риск импульсного входа");
  }

  if (anger >= 6) {
    riskScore += 3;
    readiness.emotional -= 20;
    reasons.push("злость / раздражение: риск торговли из желания отбиться");
  }

  if (dailyPnlNumber <= LOSS_LIMIT) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("дневной лимит убытка достигнут по PnL");
  }

  if (dailyLossNumber <= -1000) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("дневной убыток ниже -1000$: торговля должна быть остановлена");
  }

  if (personalDailyStopHit) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("личный дневной стоп достигнут");
  }

  if (dailyRiskRemaining < 0) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("дневной риск-бюджет превышен");
  }

  if (propDailyLossClose) {
    warnings.push("Лимит дневной просадки проп-фирмы близко. Снизь риск или остановись.");
  }

  if (tradesTodayNumber >= 3) {
    riskScore += 3;
    readiness.discipline -= 15;
    reasons.push("слишком много сделок за день: 3 или больше");
  }

  if (stopsNumber >= 3) {
    riskScore += 30;
    readiness.emotional -= 35;
    readiness.discipline -= 25;
    reasons.push("3 стопа подряд: высокий риск торговли из желания отбиться");
  }

  if (!plan) {
    riskScore += 3;
    readiness.execution -= 20;
    reasons.push("переключатель ‘Есть чёткий план сделки’ выключен");
  }

  if (!newsChecked) {
    riskScore += 2;
    readiness.execution -= 10;
    reasons.push("переключатель ‘Новости проверены’ выключен");
  }

  if (!stopSet) {
    riskScore += 5;
    readiness.discipline -= 25;
    reasons.push("переключатель ‘Стоп заранее определён’ выключен");
  }

  if (revenge) {
    riskScore += 80;
    readiness.emotional = Math.min(readiness.emotional, 10);
    readiness.discipline = Math.min(readiness.discipline, 20);
    reasons.push("включено ‘Есть желание отбиться’ — жёсткая блокировка");
  }

  if (!tradeMath.valid) {
    riskScore += 5;
    readiness.execution -= 20;
    if (!calculator.entryReason || calculator.entryReason.trim().length <= 8) reasons.push("в плане конкретной сделки нет нормальной причины входа");
    if (!tradeMath.stopValid) reasons.push("стоп в плане конкретной сделки стоит с неправильной стороны");
    if (!tradeMath.takeValid) reasons.push("тейк в плане конкретной сделки стоит с неправильной стороны");
    if (tradeMath.stopDistance <= 0) reasons.push("не заполнена дистанция до стопа в плане конкретной сделки");
    if (tradeMath.takeDistance <= 0) reasons.push("не заполнена дистанция до тейка в плане конкретной сделки");
  }

  if (sessionPlanReadyCount === 0) {
    riskScore += 3;
    readiness.execution -= 25;
    reasons.push(`нет готового сценария на дату ${activePlanDateLabel}`);
  }

  if (tradeMath.rr > 0 && tradeMath.rr < 1.5) {
    riskScore += 2;
    readiness.execution -= 10;
    warnings.push("R:R ниже 1:1.5 — сделка может быть невыгодной по математике");
  }

  const revengeDetectorScore = Math.min(
    100,
    (revenge ? 45 : 0) +
      (urge >= 7 ? 20 : 0) +
      (anger >= 6 ? 15 : 0) +
      (stopsNumber >= 2 ? 15 : 0) +
      (dailyPnlNumber < 0 ? 10 : 0) +
      (tradesTodayNumber >= 3 ? 15 : 0)
  );

  if (revengeDetectorScore >= 60) {
    reasons.push("Детектор желания отбиться: состояние похоже на попытку вернуть убыток, а не на спокойное исполнение плана");
    readiness.emotional = Math.min(readiness.emotional, 25);
  } else if (revengeDetectorScore >= 35) {
    warnings.push("Детектор желания отбиться: есть признаки эмоционального давления, снизь риск");
    readiness.emotional = Math.min(readiness.emotional, 60);
  }

  readiness.execution = Math.max(0, Math.min(100, Math.round(readiness.execution)));
  readiness.emotional = Math.max(0, Math.min(100, Math.round(readiness.emotional)));
  readiness.discipline = Math.max(0, Math.min(100, Math.round(readiness.discipline)));

  const hardLock = isLocked || dailyPnlNumber <= LOSS_LIMIT || dailyLossNumber <= -1000 || personalDailyStopHit || dailyRiskRemaining < 0 || revenge || !stopSet || !tradeMath.valid || stopsNumber >= 3;

  if (hardLock) {
    return {
      status: "LOCKED",
      title: "Торговать нельзя",
      subtitle: "Есть жёсткий блокирующий фактор. Только наблюдение или разбор.",
      risk: riskScore,
      reasons,
      warnings,
      readiness,
      revengeDetectorScore,
    };
  }

  if (riskScore >= 8) {
    return {
      status: "DANGER",
      title: "Лучше не торговать",
      subtitle: "Состояние нестабильное. Высокий риск сорваться в импульс.",
      risk: riskScore,
      reasons,
      warnings,
      readiness,
      revengeDetectorScore,
    };
  }

  if (riskScore >= 4) {
    return {
      status: "CAUTION",
      title: "Можно только минимальный риск",
      subtitle: "Одна сделка, риск 0.25%, без добора и без повторного входа.",
      risk: riskScore,
      reasons,
      warnings,
      readiness,
      revengeDetectorScore,
    };
  }

  return {
    status: "OK",
    title: "Торговать можно",
    subtitle: "Только по плану, с заранее заданным стопом и лимитом дня.",
    risk: riskScore,
    reasons,
    warnings,
    readiness,
    revengeDetectorScore,
  };
}

function formatTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "указанного времени";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
