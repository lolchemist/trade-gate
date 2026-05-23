import { useMemo } from "react";
import { MIN_SCENARIO_RR } from "@/constants/trade-gate";
import { calculateScenarioTradeMath, getPlanEntryMethod, getScenarioArguments } from "@/components/trade-gate/utils";
import type { QualityScore, SessionPlan } from "@/types/trade-gate";

type ScenarioQualityInput = {
  scenario: SessionPlan;
  hasChartImage?: boolean;
};

export function useScenarioQuality({ scenario, hasChartImage = false }: ScenarioQualityInput): QualityScore {
  return useMemo(() => calculateScenarioQuality(scenario, hasChartImage), [scenario, hasChartImage]);
}

export function calculateScenarioQuality(scenario: SessionPlan, hasChartImage = false): QualityScore {
  const strengths: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  const math = calculateScenarioTradeMath(scenario);
  const scenarioArguments = getScenarioArguments(scenario);

  const add = (condition: boolean, points: number, strength: string, gap: string) => {
    if (condition) {
      score += points;
      strengths.push(strength);
    } else {
      gaps.push(gap);
    }
  };

  add(scenarioArguments.length >= 2, 15, "есть минимум 2 аргумента сценария", "нужно минимум 2 аргумента сценария");
  add(Boolean(getPlanEntryMethod(scenario)), 18, "выбран способ входа", "не выбран способ входа");
  add(Boolean(scenario.direction), 10, "направление задано", "не выбрано направление");
  add(Boolean(scenario.entryZone.trim() && scenario.tradeEntry.trim()), 14, "триггер входа задан", "не заполнен триггер входа");
  add(Boolean(scenario.scenarioInvalidation.trim()), 10, "инвалидация понятна", "не заполнена инвалидация сценария");
  add(Boolean(scenario.stop.trim() && scenario.tradeStop.trim()), 12, "стоп определён", "не заполнен технический стоп");
  add(Boolean(scenario.take.trim() && scenario.tradeTake.trim()), 12, "тейк определён", "не заполнен технический тейк");
  add(Number(scenario.tradeRisk) > 0, 10, "риск задан", "риск на сделку не задан");
  add(math.rr >= MIN_SCENARIO_RR, 14, "RR не хуже 1:3", "отношение риск/прибыль хуже чем 1:3");
  add(hasChartImage, 7, "график прикреплён", "график не прикреплён");
  add(Number(scenario.scenarioConfidence) > 0, 5, "уверенность оценена", "уверенность не оценена");

  return {
    score: Math.min(100, Math.round(score)),
    label: score >= 80 ? "Сильный сценарий" : score >= 55 ? "Рабочий черновик" : "Слабый сценарий",
    strengths,
    gaps,
  };
}
