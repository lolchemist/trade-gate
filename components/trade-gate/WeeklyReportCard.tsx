import { BarChart3 } from "lucide-react";
import { MetricTile, PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";
import { formatCurrency, formatPlanDate } from "./utils";
import type { WeeklyReport } from "./types";

export function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  return (
    <TerminalPanel className="p-5" glow={report.totalPnl >= 0 ? "emerald" : "red"}>
      <PanelHeader
        eyebrow="Недельный отчёт"
        title={`${formatPlanDate(report.weekStart)} — ${formatPlanDate(report.weekEnd)}`}
        meta={<BarChart3 className="h-5 w-5 text-neutral-500" />}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MetricTile label="Итог недели" value={formatCurrency(report.totalPnl)} tone={report.totalPnl >= 0 ? "emerald" : "red"} />
        <MetricTile label="Сделок" value={String(report.tradeCount)} />
        <MetricTile label="Техничных" value={String(report.technicalTradeCount)} />
        <MetricTile label="Сред. аргументов" value={String(report.averageArgumentsPerTrade)} tone={report.averageArgumentsPerTrade >= 2 ? "emerald" : "amber"} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricTile label="Лучший инструмент" value={report.bestInstrument} tone="emerald" />
          <MetricTile label="Худший инструмент" value={report.worstInstrument} tone="red" />
          <MetricTile label="Лучший аргумент" value={report.bestArgument} tone="emerald" />
          <MetricTile label="Худший аргумент" value={report.worstArgument} tone="red" />
          <MetricTile label="Лучший вход" value={report.bestEntryMethod} tone="emerald" />
          <MetricTile label="Худший вход" value={report.worstEntryMethod} tone="red" />
          <MetricTile label="Лучшая связка" value={report.bestArgumentCombination} tone="emerald" />
          <MetricTile label="Техничность" value={`${report.technicalTradePercentage}%`} tone={report.technicalTradePercentage >= 70 ? "emerald" : "amber"} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Статистика по аргументам</div>
          {report.argumentStats.length === 0 ? (
            <div className="text-sm text-neutral-500">За выбранную неделю пока нет архивных сделок с входом.</div>
          ) : (
            <div className="space-y-4">
              {report.argumentStats.map((argument) => (
                <div key={argument.argumentName} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <div className="font-medium text-neutral-100">{argument.argumentName}</div>
                    <div className={`font-mono ${argument.totalPnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(argument.totalPnl)}</div>
                  </div>
                  <ProgressMeter
                    label={`${argument.tradeCount} сделок`}
                    value={argument.technicalTradePercentage}
                    detail={`${argument.technicalTradePercentage}% техничность · Winrate ${argument.winrate}% · Avg RR ${argument.averageRr.toFixed(2)}`}
                    tone={argument.technicalTradePercentage >= 70 ? "emerald" : "amber"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Частота аргументов сценария</div>
        {report.argumentFrequency.length === 0 ? (
          <div className="text-sm text-neutral-500">За выбранную неделю пока нет архивных сделок с аргументами сценария.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {report.argumentFrequency.slice(0, 8).map((argument) => (
              <div key={argument.argument} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <div className="font-medium text-neutral-100">{argument.argument}</div>
                  <div className={`font-mono ${argument.totalPnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(argument.totalPnl)}</div>
                </div>
                <ProgressMeter label={`${argument.tradeCount} сделок`} value={argument.tradeCount} max={Math.max(report.tradeCount, 1)} detail={`${argument.tradeCount}x`} tone="cyan" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Статистика по способам входа</div>
        {report.entryMethodStats.length === 0 ? (
          <div className="text-sm text-neutral-500">За выбранную неделю пока нет архивных сделок со способом входа.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {report.entryMethodStats.map((entryMethod) => (
              <div key={entryMethod.entryMethod} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                  <div className="font-medium text-neutral-100">{entryMethod.entryMethod}</div>
                  <div className={`font-mono ${entryMethod.totalPnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatCurrency(entryMethod.totalPnl)}</div>
                </div>
                <ProgressMeter
                  label={`${entryMethod.tradeCount} сделок`}
                  value={entryMethod.winrate}
                  detail={`Winrate ${entryMethod.winrate}% · Техничность ${entryMethod.technicalTradePercentage}%`}
                  tone={entryMethod.winrate >= 50 ? "emerald" : "amber"}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </TerminalPanel>
  );
}
