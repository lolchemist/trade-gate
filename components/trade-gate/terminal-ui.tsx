import type { ReactNode } from "react";

type Tone = "emerald" | "amber" | "red" | "cyan" | "neutral";

const toneBars: Record<Tone, string> = {
  emerald: "from-emerald-300/90 to-teal-200/80",
  amber: "from-amber-200/90 to-stone-300/75",
  red: "from-rose-300/80 to-stone-300/70",
  cyan: "from-sky-200/80 to-emerald-100/70",
  neutral: "from-neutral-300/80 to-neutral-500/65",
};

const toneText: Record<Tone, string> = {
  emerald: "text-emerald-100",
  amber: "text-amber-100",
  red: "text-rose-100",
  cyan: "text-sky-100",
  neutral: "text-neutral-200",
};

export function TerminalPanel({
  children,
  className = "",
  glow = "neutral",
}: {
  children: ReactNode;
  className?: string;
  glow?: Tone;
}) {
  const glowClass =
    glow === "emerald"
      ? "shadow-emerald-950/15"
      : glow === "amber"
        ? "shadow-amber-950/12"
        : glow === "red"
          ? "shadow-rose-950/18"
          : glow === "cyan"
            ? "shadow-sky-950/12"
            : "shadow-black/20";

  return (
    <div className={`rounded-[1.75rem] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))] shadow-xl ${glowClass} backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="text-xs font-medium tracking-[0.08em] text-neutral-500">{eyebrow}</div>}
        <div className="mt-1 text-lg font-semibold tracking-tight text-neutral-100">{title}</div>
      </div>
      {meta}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.032] p-4 shadow-inner shadow-black/10">
      <div className="text-xs font-medium leading-snug text-neutral-500">{label}</div>
      <div className={`mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight ${toneText[tone]}`}>{value}</div>
      {detail && <div className="mt-1 break-words text-xs leading-snug text-neutral-500">{detail}</div>}
    </div>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const classes: Record<Tone, string> = {
    emerald: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100",
    amber: "border-amber-200/20 bg-amber-200/[0.08] text-amber-100",
    red: "border-rose-300/20 bg-rose-300/[0.075] text-rose-100",
    cyan: "border-sky-200/20 bg-sky-200/[0.07] text-sky-100",
    neutral: "border-white/[0.08] bg-white/[0.045] text-neutral-300",
  };

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${classes[tone]}`}>{children}</span>;
}

export function ProgressMeter({
  label,
  value,
  max = 100,
  detail,
  tone = "emerald",
  inverse = false,
}: {
  label: string;
  value: number;
  max?: number;
  detail?: string;
  tone?: Tone;
  inverse?: boolean;
}) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const effectiveTone = inverse ? (percent >= 75 ? "red" : percent >= 45 ? "amber" : tone) : tone;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="min-w-0 font-medium leading-snug text-neutral-500">{label}</span>
        <span className={`shrink-0 font-mono ${toneText[effectiveTone]}`}>{detail ?? `${Math.round(percent)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/35 shadow-inner shadow-black/30">
        <div className={`h-full rounded-full bg-gradient-to-r ${toneBars[effectiveTone]} transition-all duration-700`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
