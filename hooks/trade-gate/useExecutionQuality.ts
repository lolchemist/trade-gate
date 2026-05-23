import { useMemo } from "react";
import type { QualityScore, ScenarioTrade, SessionPlan } from "@/types/trade-gate";

type ExecutionQualityInput = {
  scenario: SessionPlan;
  trade: ScenarioTrade;
};

export function useExecutionQuality({ scenario, trade }: ExecutionQualityInput): QualityScore {
  return useMemo(() => calculateExecutionQuality(scenario, trade), [scenario, trade]);
}

export function calculateExecutionQuality(scenario: SessionPlan, trade: ScenarioTrade): QualityScore {
  const strengths: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const add = (condition: boolean, points: number, strength: string, gap: string) => {
    if (condition) {
      score += points;
      strengths.push(strength);
    } else {
      gaps.push(gap);
    }
  };

  const actualRisk = Number(trade.actualRisk);
  const plannedRisk = Number(scenario.tradeRisk);
  const riskRespected = plannedRisk > 0 && actualRisk > 0 && actualRisk <= plannedRisk * 1.05;
  const hasOutcome = !["planned", "executed", "not_taken"].includes(trade.status);
  const hasPlannedLevels = Boolean(scenario.tradeEntry && scenario.tradeStop && scenario.tradeTake);
  const hasActualLevels = Boolean(trade.actualEntry && trade.actualStop && trade.actualTake);

  add(trade.status !== "planned", 10, "исполнение зафиксировано", "исполнение ещё не зафиксировано");
  add(hasOutcome, 10, "результат закрытия указан", "результат закрытия не указан");
  add(trade.technical === "yes", 25, "исполнение техничное", trade.technical === "partial" ? "исполнение частично техничное" : "исполнение не техничное");
  if (trade.technical === "partial") score += 12;
  add(hasPlannedLevels && hasActualLevels, 15, "план и факт можно сравнить", "не хватает плановых или фактических уровней");
  add(riskRespected, 20, "фактический риск в рамках плана", "фактический риск выше плана или не указан");
  add(Boolean(trade.executedAt), 10, "время исполнения указано", "время исполнения не указано");
  add(trade.executionNotes.trim().length > 10, 10, "есть заметка по исполнению", "нет заметки по исполнению");

  return {
    score: Math.min(100, Math.round(score)),
    label: score >= 80 ? "Хорошее исполнение" : score >= 55 ? "Смешанное исполнение" : "Слабое исполнение",
    strengths,
    gaps,
  };
}
