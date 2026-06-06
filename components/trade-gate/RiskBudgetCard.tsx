import { WalletCards } from "lucide-react";
import { NumberInput } from "./form-controls";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";

export function RiskBudgetCard({
  budgetUsd,
  plannedRiskUsed,
  usedRisk,
  realizedLossUsed = 0,
  activeRiskExposureUsed = 0,
  remainingRisk,
  isClosedDay = false,
  onBudgetChange,
}: {
  budgetUsd: string;
  plannedRiskUsed: number;
  usedRisk: number;
  realizedLossUsed?: number;
  activeRiskExposureUsed?: number;
  remainingRisk: number;
  isClosedDay?: boolean;
  onBudgetChange: (value: string) => void;
}) {
  const budget = Number(budgetUsd) || 0;
  const usedPercent = budget > 0 ? Math.min(100, Math.max(0, (usedRisk / budget) * 100)) : 0;
  const plannedPercent = budget > 0 ? Math.min(100, Math.max(0, (plannedRiskUsed / budget) * 100)) : 0;
  const locked = !isClosedDay && remainingRisk <= 0;
  const plannedRiskWarning = !isClosedDay && remainingRisk > 0 && plannedRiskUsed > remainingRisk;

  return (
    <TerminalPanel className="p-5" glow={locked ? "red" : plannedRiskWarning || usedPercent >= 80 ? "amber" : "emerald"}>
      <PanelHeader eyebrow="Риск дня" title="Дневной риск" meta={<WalletCards className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5 space-y-4">
        <ProgressMeter label="Использованный риск" value={usedRisk} max={Math.max(budget, 1)} detail={`${Math.round(usedPercent)}%`} tone={locked ? "red" : usedPercent >= 80 ? "amber" : "emerald"} />
        <ProgressMeter label="Запланированный риск" value={plannedRiskUsed} max={Math.max(budget, 1)} detail={`${Math.round(plannedPercent)}%`} tone={plannedRiskWarning ? "amber" : "neutral"} />
      </div>
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricTile label="Бюджет" value={formatCurrency(budget)} />
        <MetricTile label="Запланировано" value={formatCurrency(plannedRiskUsed)} tone={plannedRiskWarning ? "amber" : "neutral"} />
        <MetricTile label="Использовано" value={formatCurrency(usedRisk)} tone={locked ? "red" : usedRisk > 0 ? "amber" : "neutral"} />
        <MetricTile label="Закрытый убыток" value={formatCurrency(realizedLossUsed)} tone={realizedLossUsed > 0 ? "amber" : "neutral"} />
        <MetricTile label="Открытый риск" value={formatCurrency(activeRiskExposureUsed)} tone={activeRiskExposureUsed > 0 ? "amber" : "neutral"} />
        <MetricTile label="Остаток" value={formatCurrency(remainingRisk)} tone={locked ? "red" : "emerald"} />
      </div>
      <div className="mt-5">
        <NumberInput label="Изменить бюджет, $" value={budgetUsd} setValue={onBudgetChange} />
      </div>
      {isClosedDay ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.055] p-3 text-sm text-emerald-50">
          День завершён: риск больше не является допуском к новым сделкам, а остаётся частью разбора сессии.
        </div>
      ) : (
        <>
          {plannedRiskWarning && (
            <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.07] p-3 text-sm text-amber-100">
              Запланированный риск превышает доступный дневной лимит. Это предупреждение, не блокировка: уменьши риск сценариев или выбери только одну идею.
            </div>
          )}
          {locked && <div className="mt-4 rounded-2xl border border-rose-200/20 bg-rose-200/[0.07] p-3 text-sm text-rose-100">Дневной риск-лимит достигнут по использованному риску. Статус заблокирован до новой сессии.</div>}
        </>
      )}
    </TerminalPanel>
  );
}
