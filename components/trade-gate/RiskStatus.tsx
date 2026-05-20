import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReadinessCard } from "./ReadinessCard";
import type { GateResult, GateStatus } from "./types";

const statusStyles: Record<GateStatus, string> = {
  OK: "bg-emerald-500/10 border-emerald-400/30 text-emerald-200 shadow-emerald-500/10",
  CAUTION: "bg-amber-500/10 border-amber-400/30 text-amber-200 shadow-amber-500/10",
  DANGER: "bg-orange-500/10 border-orange-400/30 text-orange-200 shadow-orange-500/10",
  LOCKED: "bg-red-500/10 border-red-400/30 text-red-200 shadow-red-500/10",
};

export function RiskStatus({ result }: { result: GateResult }) {
  const StatusIcon = result.status === "OK" ? CheckCircle2 : result.status === "LOCKED" ? Lock : AlertTriangle;

  return (
    <Card className={`overflow-hidden rounded-[2rem] border shadow-2xl backdrop-blur-xl ${statusStyles[result.status]}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-2xl">
            <StatusIcon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-semibold">{result.title}</div>
            <div className="mt-1 text-sm text-neutral-300">{result.subtitle}</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Risk Score</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${Math.min(result.risk * 8, 100)}%` }} />
              </div>
              <div className="font-mono text-sm text-neutral-200">{result.risk}</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <ReadinessCard title="Execution" value={result.readiness.execution} />
              <ReadinessCard title="Emotional" value={result.readiness.emotional} />
              <ReadinessCard title="Discipline" value={result.readiness.discipline} />
              <ReadinessCard title="Revenge Risk" value={result.revengeDetectorScore} inverse />
            </div>

            {result.warnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">Предупреждения</div>
                <div className="space-y-2">
                  {result.warnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              </div>
            )}

            {result.reasons.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Почему такой статус</div>
                <div className="space-y-2">
                  {result.reasons.map((reason) => (
                    <div key={reason} className="flex items-start gap-2 text-sm text-neutral-200">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
