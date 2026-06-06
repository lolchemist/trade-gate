import { Activity } from "lucide-react";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, TerminalPanel } from "./terminal-ui";
import type { TodayMetrics } from "./types";

export function TodayMetricsCard({ metrics }: { metrics: TodayMetrics }) {
  return (
    <TerminalPanel className="p-5" glow={metrics.consecutiveStops >= 2 ? "red" : metrics.realizedPnl < 0 || metrics.consecutiveStops === 1 ? "amber" : "emerald"}>
      <PanelHeader eyebrow="Факт дня" title="Статистика дня" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-5 shadow-inner shadow-black/10">
          <div className="text-sm font-medium text-neutral-500">PnL дня</div>
          <div className={`mt-2 break-words text-4xl font-semibold tabular-nums tracking-tight ${metrics.realizedPnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
            {formatCurrency(metrics.realizedPnl)}
          </div>
          <div className="mt-2 text-xs leading-relaxed text-neutral-500">Факт по закрытым и архивным исполнениям выбранной даты.</div>
        </div>
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
          <MetricTile label="Сделок" value={String(metrics.tradesToday)} />
          <MetricTile label="Стопы подряд" value={String(metrics.consecutiveStops)} tone={metrics.consecutiveStops >= 2 ? "red" : metrics.consecutiveStops === 1 ? "amber" : "neutral"} />
          <MetricTile label="Убыток дня" value={formatCurrency(metrics.realizedLossUsed)} tone={metrics.realizedLossUsed > 0 ? "amber" : "neutral"} />
        </div>
      </div>
      <details className="group mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-400">
          Подробнее
          <span className="text-xs text-neutral-500 group-open:hidden">Открыть</span>
          <span className="hidden text-xs text-neutral-500 group-open:inline">Скрыть</span>
        </summary>
        <div className="mt-3 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
          <MetricTile label="Тейки" value={String(metrics.takeCount)} tone="emerald" />
          <MetricTile label="Стопы" value={String(metrics.stopCount)} tone={metrics.stopCount > 0 ? "red" : "neutral"} />
          <MetricTile label="Ручные закрытия" value={String(metrics.manualCloseCount)} />
          <MetricTile label="Без входа" value={String(metrics.noEntryCount)} />
        </div>
      </details>
    </TerminalPanel>
  );
}
