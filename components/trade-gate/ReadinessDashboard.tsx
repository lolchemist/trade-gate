import { Brain, Gauge, ShieldCheck, Zap } from "lucide-react";
import { PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";
import type { GateResult } from "./types";
import type { ReactNode } from "react";

export function ReadinessDashboard({
  result,
  sleep,
  anxiety,
  urge,
  anger,
}: {
  result: GateResult;
  sleep: number;
  anxiety: number;
  urge: number;
  anger: number;
}) {
  const pressure = Math.round(((anxiety + urge + anger) / 30) * 100);
  const sleepRecovery = Math.round(Math.min(100, (sleep / 8) * 100));

  return (
    <TerminalPanel className="p-5" glow={result.revengeDetectorScore >= 60 ? "red" : result.revengeDetectorScore >= 35 ? "amber" : "emerald"}>
      <PanelHeader eyebrow="Психофизиология" title="Готовность и давление" meta={<Gauge className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5 grid gap-5">
        <ProgressMeter label="Исполнение" value={result.readiness.execution} tone="emerald" />
        <ProgressMeter label="Эмоции" value={result.readiness.emotional} tone="cyan" />
        <ProgressMeter label="Дисциплина" value={result.readiness.discipline} tone="emerald" />
        <ProgressMeter label="Когнитивная ясность" value={result.readiness.cognitiveClarity} tone="cyan" />
        <ProgressMeter label="Качество сессии" value={result.readiness.sessionQuality} tone={result.readiness.sessionQuality >= 70 ? "emerald" : "amber"} />
        <ProgressMeter label="Риск отбиться" value={result.revengeDetectorScore} tone="emerald" inverse />
        <ProgressMeter label="Эмоциональное давление" value={pressure} tone="amber" inverse />
        <ProgressMeter label="Восстановление сна" value={sleepRecovery} tone="cyan" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniState icon={<Brain className="h-4 w-4" />} label="Тревога" value={`${anxiety}/10`} />
        <MiniState icon={<Zap className="h-4 w-4" />} label="Импульс" value={`${urge}/10`} />
        <MiniState icon={<ShieldCheck className="h-4 w-4" />} label="Злость" value={`${anger}/10`} />
      </div>
    </TerminalPanel>
  );
}

function MiniState({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="mt-2 font-mono text-lg text-neutral-100">{value}</div>
    </div>
  );
}
