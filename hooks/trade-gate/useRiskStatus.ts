import { useMemo } from "react";
import { LOSS_LIMIT } from "@/constants/trade-gate";
import { getBestValidScenario, validateScenarioPlan } from "@/components/trade-gate/utils";
import type { BehavioralRiskResult } from "@/hooks/trade-gate/useBehavioralRiskEngine";
import type { GateResult, ReadinessScores, SessionPlan } from "@/types/trade-gate";

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
  sessionPlansForDate: SessionPlan[];
  personalDailyStopHit: boolean;
  personalMaxRiskPerTrade: number;
  plannedRiskUsed: number;
  dailyRiskRemaining: number;
  propDailyLossClose: boolean;
  propDailyLossHit: boolean;
  behavioralRisk?: BehavioralRiskResult;
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
    sessionPlansForDate,
    personalDailyStopHit,
    personalMaxRiskPerTrade,
    plannedRiskUsed,
    dailyRiskRemaining,
    propDailyLossClose,
    propDailyLossHit,
    behavioralRisk,
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
        sessionPlansForDate,
        personalDailyStopHit,
        personalMaxRiskPerTrade,
        plannedRiskUsed,
        dailyRiskRemaining,
        propDailyLossClose,
        propDailyLossHit,
        behavioralRisk,
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
      sessionPlansForDate,
      personalDailyStopHit,
      personalMaxRiskPerTrade,
      plannedRiskUsed,
      dailyRiskRemaining,
      propDailyLossClose,
      propDailyLossHit,
      behavioralRisk,
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
  sessionPlansForDate,
  personalDailyStopHit,
  personalMaxRiskPerTrade,
  plannedRiskUsed,
  dailyRiskRemaining,
  propDailyLossClose,
  propDailyLossHit,
  behavioralRisk,
}: UseRiskStatusInput): GateResult {
  let riskScore = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const readiness: ReadinessScores = {
    execution: 100,
    emotional: 100,
    discipline: 100,
    cognitiveClarity: 100,
    sessionQuality: 100,
  };

  const now = new Date();
  const isLocked = Boolean(lockUntil && new Date(lockUntil) > now);
  const dailyPnlNumber = Number(dailyPnl);
  const dailyLossNumber = Number(dailyLoss);
  const stopsNumber = Number(consecutiveStops);
  const tradesTodayNumber = Number(tradesToday);
  const scenarioValidationOptions = { personalMaxRiskPerTrade };
  const getRemainingDailyRiskForPlan = (planItem: SessionPlan) => Math.max(0, dailyRiskRemaining + (Number(planItem.tradeRisk) || 0));
  const scenarioValidations = sessionPlansForDate.map((planItem) =>
    validateScenarioPlan(planItem, { ...scenarioValidationOptions, remainingDailyRisk: getRemainingDailyRiskForPlan(planItem) })
  );
  const validScenarioCount = scenarioValidations.filter((item) => item.valid).length;
  const bestValidScenario = getBestValidScenario(sessionPlansForDate, { ...scenarioValidationOptions, getRemainingDailyRiskForPlan });

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

  if (dailyRiskRemaining <= 0) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("Дневной риск-лимит достигнут");
  } else if (plannedRiskUsed > dailyRiskRemaining) {
    riskScore += 4;
    readiness.discipline -= 10;
    warnings.push("Запланированный риск превышает доступный дневной лимит");
  }

  if (propDailyLossHit) {
    riskScore += 50;
    readiness.discipline -= 50;
    reasons.push("лимит дневной просадки проп-фирмы достигнут");
  }

  if (propDailyLossClose) {
    warnings.push("Лимит дневной просадки проп-фирмы близко. Снизь риск или остановись.");
  }

  if (tradesTodayNumber >= 3) {
    riskScore += 3;
    readiness.discipline -= 15;
    reasons.push("слишком много сделок за день: 3 или больше");
  }

  if (stopsNumber >= 2) {
    riskScore += 30;
    readiness.emotional -= 35;
    readiness.discipline -= 25;
    reasons.push("2 стопа подряд");
  } else if (stopsNumber === 1) {
    riskScore += 2;
    readiness.discipline -= 10;
    warnings.push("Один стоп зафиксирован: ещё одна попытка только сниженным риском.");
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

  if (behavioralRisk) {
    readiness.cognitiveClarity = Math.min(readiness.cognitiveClarity, behavioralRisk.cognitiveClarity);
    readiness.sessionQuality = Math.min(readiness.sessionQuality, behavioralRisk.sessionQuality);
    readiness.emotional = Math.min(readiness.emotional, Math.max(0, 100 - behavioralRisk.revengeScore));
    if (behavioralRisk.state === "YELLOW") {
      riskScore += 4;
      warnings.push(...behavioralRisk.warnings, ...behavioralRisk.reasons);
    }
    if (behavioralRisk.state === "ORANGE") {
      riskScore += 8;
      reasons.push("ORANGE: эмоциональная нестабильность, разрешена только симуляция / cooldown");
      warnings.push(...behavioralRisk.warnings, ...behavioralRisk.reasons);
    }
    if (behavioralRisk.state === "RED") {
      riskScore += 100;
      readiness.execution = 0;
      readiness.emotional = 0;
      readiness.discipline = Math.min(readiness.discipline, 10);
      readiness.cognitiveClarity = Math.min(readiness.cognitiveClarity, 10);
      readiness.sessionQuality = Math.min(readiness.sessionQuality, 10);
      reasons.push("RED: поведенческий риск перешёл в блокировку");
      reasons.push(...behavioralRisk.reasons);
    }
  }

  if (validScenarioCount === 0) {
    riskScore += 5;
    readiness.execution -= 25;
    reasons.push("нет готового сценария на выбранную дату");

    const scenarioReasons = scenarioValidations.flatMap((item) => item.reasons);
    for (const reason of [...new Set(scenarioReasons)]) {
      reasons.push(reason);
    }
  }

  const bestScenarioRr = bestValidScenario?.validation.math.rr ?? 0;
  if (bestScenarioRr > 0 && bestScenarioRr < 1.5) {
    riskScore += 2;
    readiness.execution -= 10;
    warnings.push("Лучший готовый сценарий имеет R:R ниже 1:1.5 — сделка может быть невыгодной по математике");
  }

  const baseRevengeDetectorScore = Math.min(
    100,
    (revenge ? 45 : 0) +
      (urge >= 7 ? 20 : 0) +
      (anger >= 6 ? 15 : 0) +
      (stopsNumber >= 2 ? 15 : stopsNumber === 1 ? 8 : 0) +
      (dailyPnlNumber < 0 ? 10 : 0) +
      (tradesTodayNumber >= 3 ? 15 : 0)
  );
  const revengeDetectorScore = Math.max(baseRevengeDetectorScore, behavioralRisk?.revengeScore ?? 0);

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
  readiness.cognitiveClarity = Math.max(0, Math.min(100, Math.round(readiness.cognitiveClarity)));
  readiness.sessionQuality = Math.max(0, Math.min(100, Math.round(readiness.sessionQuality)));

  const hardLock = isLocked || dailyPnlNumber <= LOSS_LIMIT || dailyLossNumber <= -1000 || personalDailyStopHit || propDailyLossHit || dailyRiskRemaining <= 0 || revenge || !stopSet || validScenarioCount === 0 || stopsNumber >= 2 || behavioralRisk?.state === "RED";

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
