import { BrainCircuit, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { MetricTile, PanelHeader, ProgressMeter, StatusPill, TerminalPanel } from "./terminal-ui";
import type { BehavioralRiskResult } from "@/hooks/trade-gate/useBehavioralRiskEngine";

const stateLabels: Record<BehavioralRiskResult["state"], string> = {
  GREEN: "GREEN · нормальный режим",
  YELLOW: "YELLOW · сниженный риск",
  ORANGE: "ORANGE · симуляция / cooldown",
  RED: "RED · блокировка",
};

export function BehavioralRiskPanel({ behavioralRisk }: { behavioralRisk: BehavioralRiskResult }) {
  const tone = behavioralRisk.state === "GREEN" ? "emerald" : behavioralRisk.state === "YELLOW" ? "amber" : "red";
  const flags = Object.entries(behavioralRisk.flags).filter(([, enabled]) => enabled);

  return (
    <TerminalPanel className="p-5" glow={tone}>
      <PanelHeader
        eyebrow="Behavioral engine"
        title="Качество решений во время сессии"
        meta={<StatusPill tone={tone}>{stateLabels[behavioralRisk.state]}</StatusPill>}
      />
      <div className="mt-4 text-sm leading-relaxed text-neutral-400">{behavioralRisk.instruction}</div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <MetricTile label="Revenge score" value={`${behavioralRisk.revengeScore}/100`} tone={behavioralRisk.revengeScore >= 60 ? "red" : behavioralRisk.revengeScore >= 30 ? "amber" : "emerald"} />
        <MetricTile label="Режим" value={modeLabel(behavioralRisk.mode)} tone={tone} />
        <MetricTile label="Cooldown" value={behavioralRisk.cooldownMinutes > 0 ? `${behavioralRisk.cooldownMinutes}м` : "—"} tone={behavioralRisk.cooldownMinutes > 0 ? "amber" : "neutral"} />
        <MetricTile label="Max risk" value={behavioralRisk.maxAllowedRisk > 0 ? `$${behavioralRisk.maxAllowedRisk.toFixed(0)}` : "$0"} tone={tone} />
      </div>

      <div className="mt-5 grid gap-5">
        <ProgressMeter label="Когнитивная ясность" value={behavioralRisk.cognitiveClarity} tone="cyan" />
        <ProgressMeter label="Качество сессии" value={behavioralRisk.sessionQuality} tone={behavioralRisk.sessionQuality >= 70 ? "emerald" : "amber"} />
        <ProgressMeter label="Decay качества решений" value={behavioralRisk.qualityDecay} tone="amber" inverse />
        <ProgressMeter label="Эмоциональный наклон" value={behavioralRisk.emotionalSlope * 10} max={100} detail={`${behavioralRisk.emotionalSlope}`} tone="amber" inverse />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <SignalList title="Что сработало" items={behavioralRisk.reasons} empty="Жёстких поведенческих триггеров нет." icon={<BrainCircuit className="h-4 w-4" />} />
        <SignalList title="Предупреждения" items={behavioralRisk.warnings} empty="Сессия выглядит спокойно." icon={<Clock3 className="h-4 w-4" />} />
      </div>

      {flags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {flags.map(([flag]) => (
            <StatusPill key={flag} tone="amber">{flagLabel(flag)}</StatusPill>
          ))}
        </div>
      )}
    </TerminalPanel>
  );
}

function SignalList({ title, items, empty, icon }: { title: string; items: string[]; empty: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {icon}
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-neutral-500">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => (
            <div key={item} className="text-sm leading-relaxed text-neutral-300">{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function modeLabel(mode: BehavioralRiskResult["mode"]) {
  if (mode === "normal") return "Normal";
  if (mode === "reduced") return "Reduced";
  if (mode === "sim_only") return "Sim only";
  return "Locked";
}

function flagLabel(flag: string) {
  const labels: Record<string, string> = {
    rapidTradeFrequency: "частые входы",
    reEntryAfterStop: "re-entry после стопа",
    switchingAfterStop: "смена инструмента",
    largeRiskIncrease: "рост риска",
    weakScenarioDescriptions: "слабое описание",
    profitEuphoria: "profit euphoria",
    emotionalSpike: "эмоциональный всплеск",
    qualityDeteriorating: "качество падает",
    lateSessionFatigue: "усталость сессии",
  };
  return labels[flag] ?? flag;
}
