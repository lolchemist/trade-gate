import { useMemo, useState } from "react";
import { ChevronDown, GitBranch, ImageIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { ArchiveField } from "./form-controls";
import { MetricTile, StatusPill } from "./terminal-ui";
import {
  calculateScenarioTradeMath,
  formatCurrency,
  formatPlanDate,
  getPlanArgumentLabel,
  getPlanEntryMethod,
  getScenarioActualRr,
  getScenarioExecutionQuality,
  getScenarioTotalResult,
  getScenarioTrades,
} from "./utils";
import type { ArchivedPlan, ScenarioTrade, TechnicalStatus, TradeExecutionStatus } from "./types";

type ArchiveCardProps = {
  item: ArchivedPlan;
  onRestore: (id: number) => void;
};

export function ArchiveCard({ item, onRestore }: ArchiveCardProps) {
  const [open, setOpen] = useState(false);
  const tradeMath = useMemo(() => calculateScenarioTradeMath(item), [item]);
  const trades = useMemo(() => getScenarioTrades(item), [item]);
  const totalPnl = getScenarioTotalResult(item);
  const actualRr = getScenarioActualRr(item);
  const executionQuality = getScenarioExecutionQuality(item);
  const bestExecution = getBestExecution(trades);
  const worstExecution = getWorstExecution(trades);
  const entryMethod = getPlanEntryMethod(item) || "Способ не выбран";
  const argumentLabels = getPlanArgumentLabel(item)
    .split(",")
    .map((argument) => argument.trim())
    .filter(Boolean);
  const scenarioArguments = Array.isArray(item.arguments) ? item.arguments.filter(Boolean) : [];
  const allArgumentTags = [...new Set([...argumentLabels.filter((argument) => argument !== "Аргумент не выбран"), ...scenarioArguments])];
  const qualityScore = getExecutionQualityScore(executionQuality);
  const statusTone = totalPnl > 0 ? "emerald" : totalPnl < 0 ? "red" : "neutral";
  const stale = item.carryCount >= 5;

  return (
    <div className={`overflow-hidden rounded-[1.75rem] border bg-white/[0.035] shadow-inner shadow-black/15 transition ${open ? "border-emerald-100/14" : "border-white/[0.08]"}`}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-3 text-left sm:p-4">
        <div className="grid gap-4 md:grid-cols-[112px_minmax(0,1fr)_auto] md:items-center">
          <ArchiveThumbnail image={item.chartImage} symbol={item.symbol} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={item.direction === "long" ? "emerald" : item.direction === "short" ? "red" : "cyan"}>{item.direction.toUpperCase()}</StatusPill>
              <StatusPill tone="cyan">{entryMethod}</StatusPill>
              {allArgumentTags.map((argument) => (
                <StatusPill key={argument} tone="neutral">{argument}</StatusPill>
              ))}
              {item.carryCount > 0 && <StatusPill tone={stale ? "amber" : "neutral"}>Переносов: {item.carryCount}</StatusPill>}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-lg font-semibold tracking-tight text-neutral-100">{item.symbol}</div>
              <div className="text-sm text-neutral-500">{item.entryZone || item.note || "Сценарий без описания зоны"}</div>
            </div>

            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
              <CompactStat label="Исполнений" value={String(trades.length)} />
              <CompactStat label="План RR" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
              <CompactStat label="Факт RR" value={actualRr > 0 ? `1:${actualRr.toFixed(2)}` : "—"} />
              <CompactStat label="Качество" value={`${qualityScore}%`} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="text-right">
              <div className={`font-mono text-2xl font-semibold tabular-nums ${totalPnl >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatSignedCurrency(totalPnl)}</div>
              <div className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">{getScenarioOutcomeLabel(totalPnl, executionQuality)}</div>
            </div>
            <ChevronDown className={`h-5 w-5 text-neutral-500 transition ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.08] p-4 pt-5">
          {stale && (
            <div className="mb-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] px-4 py-3 text-sm text-amber-100">
              Сценарий переносился несколько дней и может быть уже неактуален.
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-5">
              <ArchiveHeroImage image={item.chartImage} symbol={item.symbol} />

              <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Сценарий</div>
                    <div className="mt-1 text-xl font-semibold text-neutral-100">
                      {item.symbol} · {item.direction.toUpperCase()} · {entryMethod}
                    </div>
                  </div>
                  <StatusPill tone={statusTone}>{getScenarioOutcomeLabel(totalPnl, executionQuality)}</StatusPill>
                </div>

                {allArgumentTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {allArgumentTags.map((argument) => (
                      <span key={argument} className="rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-1.5 text-xs text-emerald-100">
                        {argument}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-500">Аргументы сценария не указаны.</div>
                )}
              </section>

              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Планирование сценария</div>
                <div className="grid gap-2 text-sm md:grid-cols-4">
                  <ArchiveField title="Плановый вход" value={item.tradeEntry || "—"} />
                  <ArchiveField title="Плановый стоп" value={item.tradeStop || item.stop || "—"} />
                  <ArchiveField title="Плановый тейк" value={item.tradeTake || item.take || "—"} />
                  <ArchiveField title="Плановый RR" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
                  <ArchiveField title="Плановый риск" value={item.tradeRisk ? `$${item.tradeRisk}` : "—"} />
                  <ArchiveField title="Потенциал" value={tradeMath.potential > 0 ? formatCurrency(tradeMath.potential) : "—"} />
                  <ArchiveField title="Инвалидация" value={item.scenarioInvalidation || item.note || "—"} />
                  <ArchiveField title="Архивировано" value={formatDateTime(item.archivedAt)} />
                </div>
              </section>

              <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Исполнения</div>
                  <StatusPill tone="neutral">{trades.length} попыток</StatusPill>
                </div>
                {trades.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-neutral-500">По сценарию не было фактических исполнений.</div>
                ) : (
                  <div className="space-y-3">
                    {trades.map((trade, index) => (
                      <ExecutionReplayCard key={trade.id} trade={trade} index={index} />
                    ))}
                  </div>
                )}
              </section>

              <details className="group rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Комментарии и разбор</div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 group-open:hidden">Показать заметки</span>
                  <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500 group-open:inline">Скрыть</span>
                </summary>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <ArchiveField title="Комментарий закрытия" value={item.closeComment || "—"} />
                  <ArchiveField title="Архивная заметка" value={item.archiveComment || "—"} />
                  <ArchiveField title="Заметка сценария" value={item.note || "—"} />
                  <ArchiveField title="Дата закрытия" value={item.closedAt ? formatDateTime(item.closedAt) : "—"} />
                </div>
              </details>
            </div>

            <aside className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MetricTile label="Итог сценария" value={formatSignedCurrency(totalPnl)} tone={totalPnl >= 0 ? "emerald" : "red"} />
                <MetricTile label="Всего исполнений" value={String(trades.length)} />
                <MetricTile label="Лучшее исполнение" value={bestExecution ? formatSignedCurrency(Number(bestExecution.actualResult) || 0) : "—"} tone="emerald" />
                <MetricTile label="Худшее исполнение" value={worstExecution ? formatSignedCurrency(Number(worstExecution.actualResult) || 0) : "—"} tone="red" />
                <MetricTile label="Техничность" value={TECHNICAL_STATUS_LABELS[executionQuality] ?? executionQuality} tone={executionQuality === "yes" ? "emerald" : executionQuality === "partial" ? "amber" : "red"} />
              </div>

              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Replay timeline</div>
                <TimelineItem label="План сценария" value={formatPlanDate(item.planDate)} />
                {trades.map((trade, index) => (
                  <TimelineItem key={trade.id} label={trade.executionType === "trade_1" ? "Trade 1" : `Re-entry ${index}`} value={trade.executedAt ? formatDateTime(trade.executedAt) : RESULT_STATUS_LABELS[trade.status] ?? trade.status} />
                ))}
                <TimelineItem label="Архив" value={formatDateTime(item.archivedAt)} last />
              </div>

              {item.carryCount > 0 && (
                <div className="rounded-3xl border border-amber-200/15 bg-amber-200/[0.055] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                    <GitBranch className="h-4 w-4" />
                    Перенос сценария
                  </div>
                  <div className="mt-3 text-sm text-neutral-300">
                    Перенесён {item.carryCount} раз. Исходная дата: {item.carriedFromDate ? formatPlanDate(item.carriedFromDate) : "—"}.
                  </div>
                </div>
              )}

              <Button onClick={() => onRestore(item.id)} variant="outline" className="w-full rounded-2xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                <RotateCcw className="mr-2 h-4 w-4" />
                Вернуть в журнал
              </Button>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function ArchiveThumbnail({ image, symbol }: { image?: string; symbol: string }) {
  if (!image) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/25 text-neutral-600">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`График ${symbol}`} className="h-24 w-full object-cover" />
    </div>
  );
}

function ArchiveHeroImage({ image, symbol }: { image?: string; symbol: string }) {
  if (!image) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-white/[0.08] bg-black/20 text-sm uppercase tracking-[0.2em] text-neutral-600">
        График не сохранён
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-black/25 shadow-xl shadow-black/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`Архивный график ${symbol}`} className="max-h-[560px] w-full object-cover" />
    </div>
  );
}

function ExecutionReplayCard({ trade, index }: { trade: ScenarioTrade; index: number }) {
  const result = Number(trade.actualResult) || 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral">{trade.executionType === "trade_1" ? "Trade 1" : `Re-entry ${index}`}</StatusPill>
          <StatusPill tone={resultStatusTone(trade.status)}>{resultStatusLabel(trade.status)}</StatusPill>
        </div>
        <div className={`font-mono text-lg font-semibold ${result >= 0 ? "text-emerald-100" : "text-rose-100"}`}>{formatSignedCurrency(result)}</div>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <ArchiveField title="Факт вход" value={trade.actualEntry || "—"} />
        <ArchiveField title="Факт выход" value={trade.actualExit || "—"} />
        <ArchiveField title="Факт RR" value={trade.actualRr ? `1:${trade.actualRr}` : "—"} />
        <ArchiveField title="Техничность" value={TECHNICAL_STATUS_LABELS[trade.technical] ?? trade.technical} />
      </div>
      {trade.executionNotes && <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">{trade.executionNotes}</div>}
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-200">{value}</div>
    </div>
  );
}

function TimelineItem({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="relative grid grid-cols-[18px_1fr] gap-3 pb-4 last:pb-0">
      {!last && <div className="absolute left-[8px] top-4 h-full w-px bg-white/10" />}
      <div className="relative mt-1 h-4 w-4 rounded-full border border-emerald-100/20 bg-emerald-100/[0.08]" />
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
        <div className="mt-1 text-sm text-neutral-300">{value || "—"}</div>
      </div>
    </div>
  );
}

function getBestExecution(trades: ScenarioTrade[]) {
  return [...trades].sort((a, b) => (Number(b.actualResult) || 0) - (Number(a.actualResult) || 0))[0];
}

function getWorstExecution(trades: ScenarioTrade[]) {
  return [...trades].sort((a, b) => (Number(a.actualResult) || 0) - (Number(b.actualResult) || 0))[0];
}

function getExecutionQualityScore(quality: TechnicalStatus) {
  if (quality === "yes") return 100;
  if (quality === "partial") return 60;
  return 20;
}

function getScenarioOutcomeLabel(totalPnl: number, quality: TechnicalStatus) {
  if (quality === "yes" && totalPnl >= 0) return "Хороший сценарий";
  if (quality === "yes") return "Хорошее исполнение";
  if (quality === "partial") return "Частично технично";
  return "Требует разбора";
}

function resultStatusLabel(status: TradeExecutionStatus) {
  if (status === "manual_profit" || status === "manual_loss") return "MANUAL CLOSE";
  if (status === "breakeven") return "BREAKEVEN";
  if (status === "take") return "TAKE";
  if (status === "stop") return "STOP";
  return RESULT_STATUS_LABELS[status] ?? status;
}

function resultStatusTone(status: TradeExecutionStatus): "emerald" | "amber" | "red" | "neutral" {
  if (status === "take" || status === "manual_profit") return "emerald";
  if (status === "stop" || status === "manual_loss") return "red";
  if (status === "breakeven") return "amber";
  return "neutral";
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toISOString().slice(0, 10);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatPlanDate(day)} · ${hours}:${minutes}`;
}
