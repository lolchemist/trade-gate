import { CalendarClock } from "lucide-react";
import { MetricTile, PanelHeader, StatusPill, TerminalPanel } from "./terminal-ui";
import type { LocalSessionInfo } from "@/lib/ftmoTime";

const statusLabels: Record<LocalSessionInfo["status"], string> = {
  pre_session: "До сессии",
  active: "Сессия активна",
  post_session: "Сессия завершена",
  closed: "Не торговый день",
};

export function FTMOSessionCard({
  activePlanDate,
  ftmoTradingDay,
  localTradingSessionDate,
  localSession,
}: {
  activePlanDate: string;
  ftmoTradingDay: string;
  localTradingSessionDate: string;
  localSession?: LocalSessionInfo;
}) {
  const status = localSession?.status ?? "closed";
  const tone = status === "active" ? "emerald" : status === "pre_session" ? "cyan" : status === "post_session" ? "amber" : "neutral";

  return (
    <TerminalPanel className="p-5" glow={tone}>
      <PanelHeader eyebrow="Синхронизация дат" title="FTMO day · Local session · Plan date" meta={<CalendarClock className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill tone={tone}>{statusLabels[status]}</StatusPill>
        {status === "post_session" && <StatusPill tone="amber">Предложи закрыть торговый день</StatusPill>}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricTile label="FTMO trading day" value={ftmoTradingDay} detail="Europe/Prague reset" tone="cyan" />
        <MetricTile label="Local session date" value={localTradingSessionDate} detail="America/Mexico City" tone={tone} />
        <MetricTile label="Selected plan date" value={activePlanDate} detail="ручной выбор плана" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MetricTile label="До открытия" value={localSession ? formatSessionCountdown(localSession.timeUntilOpenMs) : "—"} />
        <MetricTile label="До закрытия" value={localSession ? formatSessionCountdown(localSession.timeUntilCloseMs) : "—"} tone={status === "active" ? "emerald" : "neutral"} />
      </div>
    </TerminalPanel>
  );
}

function formatSessionCountdown(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
