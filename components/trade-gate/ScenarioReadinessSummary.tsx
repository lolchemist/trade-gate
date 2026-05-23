import { ListChecks } from "lucide-react";
import { PanelHeader, StatusPill, TerminalPanel } from "./terminal-ui";
import type { ScenarioDiagnostic } from "./types";

export function ScenarioReadinessSummary({ diagnostics }: { diagnostics: ScenarioDiagnostic[] }) {
  const readyCount = diagnostics.filter((item) => item.ready).length;
  const firstBlocked = diagnostics.find((item) => !item.ready);
  const missing = firstBlocked?.missing.slice(0, 5) ?? [];
  const fixes = firstBlocked?.fixes.slice(0, 5) ?? [];

  return (
    <TerminalPanel className="p-5" glow={readyCount > 0 ? "emerald" : "amber"}>
      <PanelHeader
        eyebrow="План на дату"
        title="Готовность сценариев"
        meta={
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-neutral-500" />
            <StatusPill tone={readyCount > 0 ? "emerald" : "amber"}>{readyCount}/{diagnostics.length || 0} готовы</StatusPill>
          </div>
        }
      />

      {diagnostics.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] p-4 text-sm text-amber-100">
          Нет сценариев на выбранную дату. Без сценария приложение не даст открыть новую сделку.
        </div>
      ) : readyCount > 0 ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.06] p-4 text-sm text-emerald-50">
          Есть готовый сценарий. Допуск дальше зависит от риска, состояния и дневных лимитов.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DiagnosticList title="Что не хватает" items={missing} />
          <DiagnosticList title="Что исправить" items={fixes} />
        </div>
      )}
    </TerminalPanel>
  );
}

function DiagnosticList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-neutral-400">Критичных пробелов нет.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item} className="text-sm text-amber-50/90">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
