import { WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NumberInput, Rule, SectionTitle } from "./form-controls";
import { formatCurrency } from "./utils";

export function DailyRiskBudgetCard({
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
  return (
    <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<WalletCards className="h-4 w-4" />} title="Дневной риск-бюджет" />
        <NumberInput label="Бюджет на выбранную дату, $" value={budgetUsd} setValue={onBudgetChange} />
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Rule title="Бюджет" value={formatCurrency(Number(budgetUsd) || 0)} />
          <Rule title="Запланировано" value={formatCurrency(plannedRiskUsed)} />
          <Rule title="Остаток" value={formatCurrency(remainingRisk)} />
        </div>
        {remainingRisk < 0 && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            Дневной риск-бюджет превышен. Новые сделки заблокированы.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
