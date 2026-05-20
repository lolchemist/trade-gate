import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Rule, SectionTitle } from "./form-controls";
import { formatCurrency, formatPlanDate } from "./utils";
import type { WeeklyReport } from "./types";

export function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  return (
    <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<BarChart3 className="h-4 w-4" />} title={`Недельный отчёт: ${formatPlanDate(report.weekStart)} — ${formatPlanDate(report.weekEnd)}`} />
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Rule title="Итог недели" value={formatCurrency(report.totalPnl)} />
          <Rule title="Сделок" value={String(report.tradeCount)} />
          <Rule title="Техничных сделок" value={String(report.technicalTradeCount)} />
          <Rule title="Техничность" value={`${report.technicalTradePercentage}%`} />
          <Rule title="Лучший инструмент" value={report.bestInstrument} />
          <Rule title="Худший инструмент" value={report.worstInstrument} />
          <Rule title="Лучший сетап" value={report.bestSetup} />
          <Rule title="Худший сетап" value={report.worstSetup} />
          <Rule title="Стопов" value={String(report.stopCount)} />
          <Rule title="Тейков" value={String(report.takeCount)} />
          <Rule title="Ручных закрытий" value={String(report.manualCloseCount)} />
          <Rule title="Сценариев без входа" value={String(report.noEntryCount)} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Статистика по сетапам</div>
          {report.setupStats.length === 0 ? (
            <div className="text-sm text-neutral-500">За выбранную неделю пока нет архивных сделок с входом.</div>
          ) : (
            <div className="space-y-2">
              {report.setupStats.map((setup) => (
                <div key={setup.setupName} className="grid gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-200 md:grid-cols-[1fr_auto_auto_auto]">
                  <div className="font-medium">{setup.setupName}</div>
                  <div>Итог: {formatCurrency(setup.totalPnl)}</div>
                  <div>Сделок: {setup.tradeCount}</div>
                  <div>Техничность: {setup.technicalTradePercentage}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
