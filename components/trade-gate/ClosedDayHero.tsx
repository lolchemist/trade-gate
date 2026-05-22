import { motion } from "framer-motion";
import { CheckCircle2, Leaf, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "./utils";
import type { TodayMetrics } from "./types";

const closedMessages = [
  "Сегодняшняя работа закончена. Не ищи лишние сделки.",
  "Капитал защищён. Лучшее решение сейчас — отдых.",
  "День закрыт. Рынок никуда не исчезнет завтра.",
  "Самый сильный трейдер — тот, кто умеет остановиться вовремя.",
];

export function ClosedDayHero({
  activePlanDateLabel,
  metrics,
  disciplineScore,
  setupCount,
  onReopen,
}: {
  activePlanDateLabel: string;
  metrics: TodayMetrics;
  disciplineScore: number;
  setupCount: number;
  onReopen: () => void;
}) {
  const message = closedMessages[Math.abs(hashText(metrics.planDate)) % closedMessages.length];
  const technicalPercent = metrics.tradesToday > 0 ? Math.round(((metrics.tradesToday - metrics.manualCloseCount) / metrics.tradesToday) * 100) : 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] border border-emerald-200/16 bg-[linear-gradient(145deg,rgba(26,46,40,0.62),rgba(17,18,20,0.82))] p-6 shadow-xl shadow-emerald-950/10 backdrop-blur-2xl md:p-8"
    >
      <motion.div
        aria-hidden
        animate={{ opacity: [0.2, 0.42, 0.2], scale: [1, 1.04, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-emerald-100/10 blur-3xl"
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-100/35 to-transparent" />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-100/12 bg-emerald-100/[0.06] p-3 shadow-inner shadow-black/20">
              <CheckCircle2 className="h-6 w-6 text-emerald-100" />
            </div>
            <div>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-emerald-100/55">Session complete</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-400">Сессия · {activePlanDateLabel}</div>
            </div>
          </div>

          <div className="mt-8 text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.045em] text-emerald-50 md:text-6xl lg:text-7xl">
            Торговый день завершён
          </div>
          <div className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-neutral-200 md:text-lg">{message}</div>
          <div className="mt-2 max-w-2xl text-sm text-neutral-500">Trading finished for today. Архив сохранён, аналитика доступна, лишний риск больше не нужен.</div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" onClick={onReopen} variant="outline" className="rounded-xl border border-white/10 bg-white/[0.04] text-neutral-100 hover:bg-white/[0.08]">
              <RotateCcw className="mr-2 h-4 w-4" />
              Переоткрыть торговый день
            </Button>
          </div>
        </div>

        <div className="grid content-end gap-3">
          <ClosedMetric label="Daily PnL" value={formatCurrency(metrics.realizedPnl)} />
          <ClosedMetric label="Техничность" value={`${technicalPercent}%`} />
          <ClosedMetric label="Сетапов" value={String(setupCount)} />
          <ClosedMetric label="Риск использован" value={formatCurrency(metrics.riskUsedTotal)} />
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-relaxed text-neutral-300">
            <div className="mb-1 flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              <Leaf className="h-3.5 w-3.5" />
              Дисциплина
            </div>
            {disciplineScore}% · Trading finished for today
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ClosedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-inner shadow-black/20">
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-50">{value}</div>
    </div>
  );
}

function hashText(value: string) {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}
