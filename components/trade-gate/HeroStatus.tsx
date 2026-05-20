import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { formatCurrency } from "./utils";
import type { GateResult, PermissionToTrade } from "./types";

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

export function HeroStatus({
  result,
  permission,
  activePlanDateLabel,
}: {
  result: GateResult;
  permission: PermissionToTrade;
  activePlanDateLabel: string;
}) {
  const denied = permission.permission === "denied" || result.status === "LOCKED";
  const reduced = permission.permission === "reduced" || result.status === "CAUTION" || result.status === "DANGER";
  const tone: HeroTone = denied ? "red" : reduced ? "amber" : "emerald";
  const label = denied ? "БЛОКИРОВКА" : reduced ? "СНИЖЕННЫЙ РИСК" : "ТОРГОВЛЯ РАЗРЕШЕНА";
  const permissionLabel = permission.permission === "granted" ? "РАЗРЕШЁН" : permission.permission === "reduced" ? "СНИЖЕН" : "ЗАПРЕЩЁН";
  const StatusIcon = denied ? Lock : reduced ? AlertTriangle : CheckCircle2;
  const primaryReason = result.reasons[0] ?? result.warnings[0] ?? result.subtitle;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
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
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-neutral-500">Поведенческий риск-терминал</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-400">Сессия · {activePlanDateLabel}</div>
            </div>
          </div>

          <div className={`mt-8 text-4xl font-semibold uppercase leading-[0.92] tracking-[-0.045em] ${toneClasses[tone].text} md:text-6xl lg:text-7xl`}>
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
            <div className="mb-1 flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
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
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClasses[tone].text}`}>{value}</div>
    </div>
  );
}
