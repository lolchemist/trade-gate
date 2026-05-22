import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "./utils";
import type { TodayMetrics } from "./types";

export function ClosedDayHero({
  activePlanDateLabel,
  metrics,
  disciplineScore,
  technicalPercent,
  setupCount,
  onReopen,
}: {
  activePlanDateLabel: string;
  metrics: TodayMetrics;
  disciplineScore: number;
  technicalPercent: number;
  setupCount: number;
  onReopen: () => void;
}) {
  const message = "День закрыт. Рынок будет и завтра. Лучшее решение сейчас — отдых.";
  const pnlPositive = metrics.realizedPnl >= 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] border border-emerald-100/12 bg-[linear-gradient(145deg,rgba(24,36,32,0.72),rgba(14,15,17,0.88))] p-5 shadow-xl shadow-black/18 backdrop-blur-2xl md:p-7"
    >
      <motion.div
        aria-hidden
        animate={{ opacity: [0.12, 0.24, 0.12], scale: [1, 1.03, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-100/10 blur-3xl"
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-100/25 to-transparent" />

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-100/12 bg-emerald-100/[0.055] p-2.5 shadow-inner shadow-black/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-100" />
            </div>
            <div>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-emerald-100/55">Trading day closed</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-400">Сессия · {activePlanDateLabel}</div>
            </div>
          </div>

          <div className="mt-6 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-emerald-50 md:text-5xl">
            Торговый день завершён
          </div>
          <div className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-neutral-200">{message}</div>
          <div className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            Итоги зафиксированы, архив сохранён, аналитика доступна. Следующая профессиональная задача — не добавлять лишний риск.
          </div>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <SummaryPill label="Сделок" value={String(metrics.tradesToday)} />
            <SummaryPill label="Сетапов" value={String(setupCount)} />
            <SummaryPill label="Статус" value="Завершён" />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035] p-3 shadow-inner shadow-black/20 md:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                <Sparkles className="h-3.5 w-3.5 text-emerald-100/70" />
                Profit / Loss today
              </div>
              <div className={`mt-2 font-mono text-4xl font-semibold tabular-nums tracking-[-0.03em] ${pnlPositive ? "text-emerald-50" : "text-amber-100"}`}>
                {formatSignedCurrency(metrics.realizedPnl)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ClosedMetric label="Техничные" value={`${technicalPercent}%`} />
              <ClosedMetric label="Сделки" value={String(metrics.tradesToday)} />
              <ClosedMetric label="Дисциплина" value={`${disciplineScore}%`} />
              <ClosedMetric label="Риск" value={formatCurrency(metrics.riskUsedTotal)} />
            </div>
            <Button type="button" onClick={onReopen} variant="outline" className="h-11 rounded-xl border border-white/10 bg-white/[0.04] text-neutral-100 hover:bg-white/[0.08]">
              <RotateCcw className="mr-2 h-4 w-4" />
              Переоткрыть день
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ClosedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 shadow-inner shadow-black/20">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-50">{value}</div>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
      <div className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-neutral-100">{value}</div>
    </div>
  );
}

function formatSignedCurrency(value: number) {
  const formatted = formatCurrency(value);
  return value > 0 ? `+${formatted}` : formatted;
}
