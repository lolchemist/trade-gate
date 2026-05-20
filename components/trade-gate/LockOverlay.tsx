import { useEffect, useMemo, useState } from "react";
import { Lock, TimerReset } from "lucide-react";
import { TerminalPanel } from "./terminal-ui";
import type { GateResult } from "./types";

export function LockOverlay({
  result,
  lockUntil,
}: {
  result: GateResult;
  lockUntil: string;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (result.status !== "LOCKED") return;
    const update = () => setNow(Date.now());
    const timeout = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [result.status, lockUntil]);

  const countdown = useMemo(() => {
    if (!lockUntil || now === 0) return "";
    const remaining = new Date(lockUntil).getTime() - now;
    if (remaining <= 0) return "00:00:00";
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  }, [lockUntil, now]);

  if (result.status !== "LOCKED") return null;

  return (
    <TerminalPanel className="relative overflow-hidden p-5" glow="red">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.09),transparent_42%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-rose-200/20 bg-rose-200/[0.08] p-3 text-rose-100 shadow-inner shadow-black/20">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-200/75">Защитная пауза</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-rose-50">Не исполнять сделки</div>
            <div className="mt-2 max-w-2xl text-sm leading-relaxed text-rose-50/70">Сейчас задача — защитить капитал и нервную систему. Закрой терминал, зафиксируй состояние и вернись к разбору без рынка.</div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-right">
          <div className="flex items-center justify-end gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-rose-100/70">
            <TimerReset className="h-3.5 w-3.5" />
            Таймер
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-rose-50">{countdown || "до устранения причины"}</div>
        </div>
      </div>
    </TerminalPanel>
  );
}
