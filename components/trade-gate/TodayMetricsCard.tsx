import { Activity } from "lucide-react";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, TerminalPanel } from "./terminal-ui";
import type { TodayMetrics } from "./types";

export function TodayMetricsCard({ metrics }: { metrics: TodayMetrics }) {
  return (
    <TerminalPanel className="p-5" glow={metrics.realizedPnl < 0 || metrics.consecutiveStops >= 2 ? "amber" : "emerald"}>
      <PanelHeader eyebrow="Факт дня" title="Итоги выбранной даты" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Daily PnL" value={formatCurrency(metrics.realizedPnl)} tone={metrics.realizedPnl >= 0 ? "emerald" : "red"} />
        <MetricTile label="Сделок" value={String(metrics.tradesToday)} detail="исполненные архивные сделки" />
        <MetricTile label="Стопы подряд" value={String(metrics.consecutiveStops)} tone={metrics.consecutiveStops >= 3 ? "red" : metrics.consecutiveStops >= 2 ? "amber" : "neutral"} />
        <MetricTile label="Убыток дня" value={formatCurrency(metrics.realizedLossUsed)} tone={metrics.realizedLossUsed > 0 ? "amber" : "neutral"} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <MetricTile label="Тейки" value={String(metrics.takeCount)} tone="emerald" />
        <MetricTile label="Стопы" value={String(metrics.stopCount)} tone={metrics.stopCount > 0 ? "red" : "neutral"} />
        <MetricTile label="Ручные закрытия" value={String(metrics.manualCloseCount)} />
        <MetricTile label="Без входа" value={String(metrics.noEntryCount)} />
      </div>
    </TerminalPanel>
  );
}
