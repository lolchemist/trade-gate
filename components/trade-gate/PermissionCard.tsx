import { BadgeCheck } from "lucide-react";
import { MetricTile, PanelHeader, StatusPill, TerminalPanel } from "./terminal-ui";
import { formatCurrency } from "./utils";
import type { PermissionToTrade } from "./types";

const permissionLabels: Record<PermissionToTrade["permission"], string> = {
  granted: "РАЗРЕШЕНО",
  reduced: "СНИЖЕННЫЙ РИСК",
  denied: "ЗАПРЕЩЕНО",
};

export function PermissionCard({ permission }: { permission: PermissionToTrade }) {
  if (permission.instruction === "Trading finished for today") {
    return (
      <TerminalPanel className="p-5" glow="emerald">
        <PanelHeader
          eyebrow="Финальный фильтр"
          title="Торговля завершена"
          meta={
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-emerald-100" />
              <StatusPill tone="emerald">ДЕНЬ ЗАКРЫТ</StatusPill>
            </div>
          }
        />
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-200">Trading finished for today</div>
      </TerminalPanel>
    );
  }

  const tone = permission.permission === "granted" ? "emerald" : permission.permission === "reduced" ? "amber" : "red";

  return (
    <TerminalPanel className="p-5" glow={tone}>
      <PanelHeader
        eyebrow="Финальный фильтр"
        title="Разрешение на сделку"
        meta={
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-neutral-500" />
            <StatusPill tone={tone}>{permissionLabels[permission.permission]}</StatusPill>
          </div>
        }
      />
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <MetricTile label="Макс. риск" value={formatCurrency(permission.maxAllowedRisk)} tone={tone} />
        <MetricTile label="Макс. лот" value={permission.maxAllowedLot > 0 ? permission.maxAllowedLot.toFixed(2) : "0.00"} tone={tone} />
        <MetricTile label="Ещё сделок" value={String(permission.maxAdditionalTrades)} />
        <MetricTile label="Повторный вход" value={permission.reEntryAllowed ? "Да" : "Нет"} tone={permission.reEntryAllowed ? "emerald" : "red"} />
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-200">{permission.instruction}</div>
    </TerminalPanel>
  );
}
