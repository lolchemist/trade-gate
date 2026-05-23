import { Button } from "@/components/ui/button";
import { RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "./constants";
import { ArchiveField } from "./form-controls";
import {
  calculateScenarioTradeMath,
  getPlanArgumentLabel,
  getPlanEntryMethod,
  getScenarioActualRr,
  getScenarioExecutionQuality,
  getScenarioTotalResult,
  getScenarioTrades,
} from "./utils";
import type { ArchivedPlan } from "./types";

type ArchiveCardProps = {
  item: ArchivedPlan;
  onRestore: (id: number) => void;
};

export function ArchiveCard({ item, onRestore }: ArchiveCardProps) {
  const tradeMath = calculateScenarioTradeMath(item);
  const actualRr = getScenarioActualRr(item);
  const trades = getScenarioTrades(item);
  const executionQuality = getScenarioExecutionQuality(item);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {item.symbol} · {item.direction.toUpperCase()} · {item.entryZone}
          </div>
          <div className="mt-1 text-xs text-neutral-500">Архивировано: {item.archivedAt}</div>
        </div>
        <Button onClick={() => onRestore(item.id)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
          Вернуть
        </Button>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <ArchiveField title="Аргументы" value={getPlanArgumentLabel(item)} />
        <ArchiveField title="Способ входа" value={getPlanEntryMethod(item) || "—"} />
        <ArchiveField title="Плановый R:R" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
        <ArchiveField title="Факт R:R" value={actualRr > 0 ? `1:${actualRr.toFixed(2)}` : "—"} />
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <ArchiveField title="Итог сценария" value={`$${getScenarioTotalResult(item).toFixed(0)}`} />
        <ArchiveField title="Исполнений" value={String(trades.length)} />
        <ArchiveField title="Качество исполнения" value={TECHNICAL_STATUS_LABELS[executionQuality] ?? executionQuality} />
        <ArchiveField title="Закрыта" value={item.closedAt || "—"} />
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        <ArchiveField title="Отмена сценария" value={item.note || "—"} />
        <ArchiveField title="Комментарий закрытия" value={item.closeComment || "—"} />
        <ArchiveField title="Ключ графика" value={item.chartImageKey || "—"} />
      </div>

      {item.chartImage && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.chartImage} alt={`Архивный график ${item.symbol}`} className="max-h-72 w-full rounded-lg object-cover" />
        </div>
      )}

      {trades.length > 0 && (
        <div className="mt-3 space-y-2">
          {trades.map((trade) => (
            <div key={trade.id} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-neutral-100">{trade.executionType === "trade_1" ? "Trade 1" : "Re-entry"}</span>
                <span>{trade.status === "planned" || trade.status === "executed" ? trade.status : RESULT_STATUS_LABELS[trade.status] ?? trade.status}</span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <ArchiveField title="Вход / выход" value={`${trade.actualEntry || "—"} → ${trade.actualExit || "—"}`} />
                <ArchiveField title="Риск" value={trade.actualRisk ? `$${trade.actualRisk}` : "—"} />
                <ArchiveField title="Результат" value={trade.actualResult ? `$${trade.actualResult}` : "—"} />
                <ArchiveField title="Техничность" value={TECHNICAL_STATUS_LABELS[trade.technical] ?? trade.technical} />
              </div>
            </div>
          ))}
        </div>
      )}

      {item.archiveComment && <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300">{item.archiveComment}</div>}
    </div>
  );
}
