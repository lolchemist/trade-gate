import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { ClosedDayHero } from "./ClosedDayHero";
import { formatCurrency, formatSyncStatus } from "./utils";
import type { GateResult, PermissionToTrade, TodayMetrics, TradingDayStatus } from "./types";

type HeroTone = "emerald" | "amber" | "red";

const toneClasses: Record<HeroTone, { shell: string; glow: string; text: string; rail: string }> = {
  emerald: {
    shell: "border-emerald-300/18 bg-emerald-300/[0.055] shadow-emerald-950/18",
    glow: "bg-emerald-200/12",
    text: "text-emerald-100",
    rail: "from-emerald-200/90 via-teal-100/80 to-sky-100/70",
  },
  amber: {
    shell: "border-amber-200/18 bg-amber-200/[0.06] shadow-amber-950/14",
    glow: "bg-amber-100/12",
    text: "text-amber-100",
    rail: "from-amber-100/90 via-stone-200/75 to-orange-100/70",
  },
  red: {
    shell: "border-rose-200/16 bg-[linear-gradient(145deg,rgba(78,28,38,0.58),rgba(23,18,21,0.72))] shadow-rose-950/18",
    glow: "bg-rose-200/10",
    text: "text-rose-50",
    rail: "from-rose-100/80 via-stone-200/70 to-amber-100/60",
  },
};

type BaseHeroProps = {
  result: GateResult;
  permission: PermissionToTrade;
  activePlanDateLabel: string;
  activePlanDate: string;
  tradingDayStatusByDate: Record<string, TradingDayStatus>;
  closedDay?: {
    metrics: TodayMetrics;
    disciplineScore: number;
    technicalPercent: number;
    argumentCount: number;
    onReopen: () => void;
  };
};

export function ActiveTradingHero(props: BaseHeroProps) {
  return <TradingHeroBase {...props} forceLocked={false} />;
}

export function LockedHero(props: BaseHeroProps) {
  return <TradingHeroBase {...props} forceLocked />;
}

export function HeroStatus(props: BaseHeroProps) {
  return <TradingHeroBase {...props} forceLocked={props.result.status === "LOCKED"} />;
}

export function LoadingHero({ syncStatus }: { syncStatus: string }) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6 shadow-xl shadow-black/20 backdrop-blur-2xl md:p-8"
    >
      <motion.div
        aria-hidden
        animate={{ opacity: [0.18, 0.34, 0.18], scale: [1, 1.035, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-emerald-200/8 blur-3xl"
      />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 shadow-inner shadow-black/20">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
            </div>
            <div>
              <div className="text-xs font-medium tracking-[0.08em] text-neutral-500">Допуск к сделке</div>
              <div className="mt-1 text-xs text-neutral-400">Данные ещё загружаются</div>
            </div>
          </div>
          <div className="mt-8 text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-neutral-100 md:text-6xl">
            Проверяю допуск
          </div>
          <div className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-neutral-300 md:text-lg">
            Пока данные загружаются, торговля закрыта. Это защита от ложного разрешения на вход.
          </div>
          <div className="mt-2 max-w-2xl text-sm text-neutral-500">
            Сначала читаю локальное состояние, затем проверяю Supabase.
          </div>
        </div>
        <div className="grid content-end gap-3">
          <HeroMetric label="Допуск" value="проверка" tone="amber" />
          <HeroMetric label="Риск дня" value="—" tone="amber" />
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-relaxed text-neutral-300">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-500">
              <Activity className="h-3.5 w-3.5" />
              Статус
            </div>
            читаю данные · {formatSyncStatus(syncStatus || "Loading local data")}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function TradingHeroBase({
  result,
  permission,
  activePlanDateLabel,
  activePlanDate,
  tradingDayStatusByDate,
  closedDay,
  forceLocked,
}: BaseHeroProps & {
  forceLocked: boolean;
}) {
  const currentDayStatus = tradingDayStatusByDate[activePlanDate] ?? "active";

  if (currentDayStatus === "closed" && closedDay) {
    return (
      <ClosedDayHero
        activePlanDateLabel={activePlanDateLabel}
        metrics={closedDay.metrics}
        disciplineScore={closedDay.disciplineScore}
        technicalPercent={closedDay.technicalPercent}
        argumentCount={closedDay.argumentCount}
        onReopen={closedDay.onReopen}
      />
    );
  }

  const denied = forceLocked;
  const reduced = !denied && (permission.permission === "reduced" || result.status === "CAUTION" || result.status === "DANGER");
  const tone: HeroTone = denied ? "red" : reduced ? "amber" : "emerald";
  const label = denied ? "ТОРГОВЛЯ ЗАПРЕЩЕНА" : reduced ? "МОЖНО С ОГРАНИЧЕНИЕМ" : "МОЖНО ТОРГОВАТЬ";
  const permissionLabel = permission.permission === "granted" ? "РАЗРЕШЁН" : permission.permission === "reduced" ? "СНИЖЕН" : "ЗАПРЕЩЁН";
  const StatusIcon = denied ? Lock : reduced ? AlertTriangle : CheckCircle2;
  const primaryReason = result.reasons[0] ?? result.warnings[0] ?? result.subtitle;

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-xl backdrop-blur-2xl md:p-8 ${toneClasses[tone].shell}`}
    >
      <motion.div
        aria-hidden
        animate={{ opacity: [0.25, 0.48, 0.25], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute -right-16 -top-20 h-80 w-80 rounded-full blur-3xl ${toneClasses[tone].glow}`}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 shadow-inner shadow-black/20">
              <StatusIcon className={`h-6 w-6 ${toneClasses[tone].text}`} />
            </div>
            <div>
              <div className="text-xs font-medium tracking-[0.08em] text-neutral-500">Допуск к сделке</div>
              <div className="mt-1 text-xs text-neutral-400">Сессия · {activePlanDateLabel}</div>
            </div>
          </div>

          <div className={`mt-8 text-4xl font-semibold uppercase leading-[0.95] tracking-[-0.04em] ${toneClasses[tone].text} md:text-5xl lg:text-6xl`}>
            {label}
          </div>
          <div className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-neutral-200 md:text-lg">{primaryReason}</div>
          <div className="mt-2 max-w-2xl text-sm text-neutral-500">{result.subtitle}</div>
          <div className="mt-7 h-1 overflow-hidden rounded-full bg-black/35 shadow-inner shadow-black/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(result.risk * 8, 100)}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${toneClasses[tone].rail}`}
            />
          </div>
        </div>

        <div className="grid content-end gap-3">
          <HeroMetric label="Допуск" value={permissionLabel} tone={tone} />
          <HeroMetric label="Макс. риск" value={formatCurrency(permission.maxAllowedRisk)} tone={tone} />
          <HeroMetric label="Риск-скор" value={String(result.risk)} tone={tone} />
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-relaxed text-neutral-300">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-neutral-500">
              <Activity className="h-3.5 w-3.5" />
              Инструкция
            </div>
            {permission.instruction}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function HeroMetric({ label, value, tone }: { label: string; value: string; tone: HeroTone }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 shadow-inner shadow-black/20">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClasses[tone].text}`}>{value}</div>
    </div>
  );
}
