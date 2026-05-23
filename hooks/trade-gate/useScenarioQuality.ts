import { useMemo } from "react";
import { calculateScenarioTradeMath, getPlanArgumentNames, getPlanEntryMethod } from "@/components/trade-gate/utils";
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

  const add = (condition: boolean, points: number, strength: string, gap: string) => {
    if (condition) {
      score += points;
      strengths.push(strength);
    } else {
      gaps.push(gap);
    }
  };

  add(getPlanArgumentNames(scenario).length > 0, 15, "есть аргумент для сделки", "нет аргумента для сделки");
  add(Boolean(getPlanEntryMethod(scenario)), 15, "выбран способ входа", "не выбран способ входа");
  add(Boolean(scenario.direction), 8, "направление задано", "не выбрано направление");
  add(Boolean(scenario.entryZone.trim()), 10, "зона входа задана", "не заполнена зона входа");
  add(Boolean(scenario.scenarioInvalidation.trim()), 10, "инвалидация понятна", "не заполнена инвалидация сценария");
  add(Boolean(scenario.stop.trim() && scenario.tradeStop.trim()), 10, "стоп определён", "не заполнен технический стоп");
  add(Boolean(scenario.take.trim() && scenario.tradeTake.trim()), 10, "тейк определён", "не заполнен технический тейк");
  add(Number(scenario.tradeRisk) > 0, 8, "риск задан", "риск на сделку не задан");
  add(math.rr >= 1.5, 10, "RR выше 1:1.5", "RR ниже 1:1.5 или не рассчитан");
  add(hasChartImage, 7, "график прикреплён", "график не прикреплён");
  add(Number(scenario.scenarioConfidence) > 0, 5, "уверенность оценена", "уверенность не оценена");

  return {
    score: Math.min(100, Math.round(score)),
    label: score >= 80 ? "Сильный сценарий" : score >= 55 ? "Рабочий черновик" : "Слабый сценарий",
    strengths,
    gaps,
  };
}
