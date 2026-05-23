import { useMemo } from "react";
import { calculateScenarioQuality } from "./useScenarioQuality";
import { validateScenarioPlan } from "@/components/trade-gate/utils";
import type { ScenarioDiagnostic, SessionPlan } from "@/types/trade-gate";

export function useScenarioDiagnostics(scenarios: SessionPlan[], chartImageByScenarioId: Record<number, boolean> = {}) {
  return useMemo(
    () =>
      scenarios.map((scenario) =>
        calculateScenarioDiagnostic(scenario, Boolean(chartImageByScenarioId[scenario.id]))
      ),
    [scenarios, chartImageByScenarioId]
  );
}

export function useScenarioDiagnostic(scenario: SessionPlan, hasChartImage = false) {
  return useMemo(() => calculateScenarioDiagnostic(scenario, hasChartImage), [scenario, hasChartImage]);
}

export function calculateScenarioDiagnostic(scenario: SessionPlan, hasChartImage = false): ScenarioDiagnostic {
  const validation = validateScenarioPlan(scenario);
  const quality = calculateScenarioQuality(scenario, hasChartImage);

  return {
    scenario,
    ready: validation.valid,
    validation,
    quality,
    missing: validation.reasons,
    fixes: quality.gaps,
  };
}
