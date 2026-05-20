import { WalletCards } from "lucide-react";
import { NumberInput } from "./form-controls";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";

export function RiskBudgetCard({
  budgetUsd,
  plannedRiskUsed,
  remainingRisk,
  onBudgetChange,
}: {
  budgetUsd: string;
  plannedRiskUsed: number;
  remainingRisk: number;
  onBudgetChange: (value: string) => void;
}) {
  const budget = Number(budgetUsd) || 0;
  const usedPercent = budget > 0 ? Math.min(100, Math.max(0, (plannedRiskUsed / budget) * 100)) : 0;
  const locked = remainingRisk < 0;

  return (
    <TerminalPanel className="p-5" glow={locked ? "red" : usedPercent >= 80 ? "amber" : "emerald"}>
      <PanelHeader eyebrow="Риск дня" title="Дневной риск-бюджет" meta={<WalletCards className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5">
        <ProgressMeter label="Использование риска" value={plannedRiskUsed} max={Math.max(budget, 1)} detail={`${Math.round(usedPercent)}%`} tone={locked ? "red" : usedPercent >= 80 ? "amber" : "emerald"} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricTile label="Бюджет" value={formatCurrency(budget)} />
        <MetricTile label="Запланировано" value={formatCurrency(plannedRiskUsed)} tone={usedPercent >= 80 ? "amber" : "neutral"} />
        <MetricTile label="Остаток" value={formatCurrency(remainingRisk)} tone={locked ? "red" : "emerald"} />
      </div>
      <div className="mt-5">
        <NumberInput label="Изменить бюджет, $" value={budgetUsd} setValue={onBudgetChange} />
      </div>
      {locked && <div className="mt-4 rounded-2xl border border-rose-200/20 bg-rose-200/[0.07] p-3 text-sm text-rose-100">Дневной риск-бюджет превышен. Статус остаётся заблокированным до снижения планового риска.</div>}
    </TerminalPanel>
  );
}
