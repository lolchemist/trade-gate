import { Activity, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";
import type { WeeklyReport } from "./types";

type AnalyticsRow = { label: string; value: number };

export function AnalyticsDashboard({
  report,
  byInstrument,
  byArgument,
  byEntryMethod,
  mistakeCount,
  revengeNoteCount,
}: {
  report: WeeklyReport;
  byInstrument: AnalyticsRow[];
  byArgument: AnalyticsRow[];
  byEntryMethod: AnalyticsRow[];
  mistakeCount: number;
  revengeNoteCount: number;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile label="Итог недели" value={formatCurrency(report.totalPnl)} tone={report.totalPnl >= 0 ? "emerald" : "red"} />
        <MetricTile label="Сделок" value={String(report.tradeCount)} />
        <MetricTile label="Техничность" value={`${report.technicalTradePercentage}%`} tone={report.technicalTradePercentage >= 70 ? "emerald" : "amber"} />
        <MetricTile label="Ошибок" value={String(mistakeCount)} tone={mistakeCount > 0 ? "red" : "emerald"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TerminalPanel className="p-5" glow="emerald">
          <PanelHeader eyebrow="Тепловая карта" title="Финрезультат по инструментам" meta={<TrendingUp className="h-5 w-5 text-neutral-500" />} />
          <Heatmap rows={byInstrument} empty="Нет архивных сделок по инструментам за выбранную неделю." />
        </TerminalPanel>

        <TerminalPanel className="p-5" glow="cyan">
          <PanelHeader eyebrow="Тепловая карта" title="Финрезультат по аргументам" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
          <Heatmap rows={byArgument} empty="Нет архивных сделок по аргументам за выбранную неделю." />
        </TerminalPanel>

        <TerminalPanel className="p-5" glow="amber">
          <PanelHeader eyebrow="Метод исполнения" title="Финрезультат по способам входа" meta={<Activity className="h-5 w-5 text-neutral-500" />} />
          <Heatmap rows={byEntryMethod} empty="Нет архивных сделок по способам входа за выбранную неделю." />
        </TerminalPanel>
      </div>

      <TerminalPanel className="p-5" glow={report.stopCount > report.takeCount ? "red" : "neutral"}>
        <PanelHeader eyebrow="Поведенческая лента" title="События недели" meta={<Flame className="h-5 w-5 text-neutral-500" />} />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <ProgressMeter label="Стопы" value={report.stopCount} max={Math.max(report.tradeCount, 1)} detail={String(report.stopCount)} tone="red" inverse />
            <ProgressMeter label="Тейки" value={report.takeCount} max={Math.max(report.tradeCount, 1)} detail={String(report.takeCount)} tone="emerald" />
            <ProgressMeter label="Ручные закрытия" value={report.manualCloseCount} max={Math.max(report.tradeCount, 1)} detail={String(report.manualCloseCount)} tone="amber" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Без входа" value={String(report.noEntryCount)} />
            <MetricTile label="Заметки отбиться" value={String(revengeNoteCount)} tone={revengeNoteCount > 0 ? "red" : "neutral"} />
            <MetricTile label="Лучший аргумент" value={report.bestArgument} tone="emerald" />
            <MetricTile label="Худший аргумент" value={report.worstArgument} tone="red" />
            <MetricTile label="Лучший вход" value={report.bestEntryMethod} tone="emerald" />
            <MetricTile label="Худший вход" value={report.worstEntryMethod} tone="red" />
          </div>
        </div>
      </TerminalPanel>
    </div>
  );
}

function Heatmap({ rows, empty }: { rows: AnalyticsRow[]; empty: string }) {
  if (rows.length === 0) {
    return <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-neutral-500">{empty}</div>;
  }

  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="mt-5 grid gap-3">
      {rows.map((row) => {
        const intensity = Math.max(12, Math.round((Math.abs(row.value) / maxAbs) * 100));
        const positive = row.value >= 0;
        return (
          <div key={row.label} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div
              className={`absolute inset-y-0 left-0 ${positive ? "bg-emerald-200/[0.09]" : "bg-rose-200/[0.08]"}`}
              style={{ width: `${intensity}%` }}
            />
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                {positive ? <TrendingUp className="h-4 w-4 text-emerald-200" /> : <TrendingDown className="h-4 w-4 text-rose-200" />}
                {row.label}
              </div>
              <div className={`font-mono text-sm font-semibold tabular-nums ${positive ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(row.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
