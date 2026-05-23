import { CalendarDays } from "lucide-react";
import { ArchiveCard } from "./ArchiveCard";
import { MetricTile, StatusPill, TerminalPanel } from "./terminal-ui";
import { formatCurrency, formatPlanDate, getScenarioExecutionQuality, getScenarioTotalResult, getScenarioTrades } from "./utils";
import type { ArchivedPlan } from "./types";

export function ArchiveDayGroup({ planDate, plans, onRestore }: { planDate: string; plans: ArchivedPlan[]; onRestore: (id: number) => void }) {
  const totalPnl = plans.reduce((total, plan) => total + getScenarioTotalResult(plan), 0);
  const technicalScenarios = plans.filter((plan) => getScenarioExecutionQuality(plan) === "yes").length;
  const trades = plans.flatMap(getScenarioTrades);
  const stopCount = trades.filter((trade) => trade.status === "stop").length;
  const reEntryCount = trades.filter((trade) => trade.executionType === "re_entry").length;
  const takeCount = trades.filter((trade) => trade.status === "take").length;

  return (
    <TerminalPanel className="overflow-hidden" glow={totalPnl >= 0 ? "emerald" : "red"}>
      <div className="border-b border-white/[0.08] bg-white/[0.035] p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={totalPnl >= 0 ? "emerald" : "red"}>{formatCurrency(totalPnl)}</StatusPill>
              <StatusPill>{plans.length} сценариев</StatusPill>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-2.5">
                <CalendarDays className="h-5 w-5 text-emerald-100/70" />
              </div>
              <div>
                <div className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-neutral-500">Trading memory</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-neutral-100">{formatPlanDate(planDate)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <MetricTile label="Техничных" value={String(technicalScenarios)} />
            <MetricTile label="Стопы" value={String(stopCount)} tone={stopCount > takeCount ? "red" : "neutral"} />
            <MetricTile label="Тейки" value={String(takeCount)} tone="emerald" />
            <MetricTile label="Re-entry" value={String(reEntryCount)} tone={reEntryCount > 0 ? "cyan" : "neutral"} />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {plans.map((plan) => (
          <ArchiveCard key={plan.id} item={plan} onRestore={onRestore} />
        ))}
      </div>
    </TerminalPanel>
  );
}
