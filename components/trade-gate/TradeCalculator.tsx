import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NumberInput, Rule, SectionTitle, SelectInput, TextInput, Warning } from "./form-controls";
import type { TradeCalculatorField, TradeCalculatorState, TradeDirection, TradeMath } from "./types";

const directionOptions: { value: TradeDirection; label: string }[] = [
  { value: "long", label: "Лонг" },
  { value: "short", label: "Шорт" },
];

export function TradeCalculator({
  calculator,
  tradeMath,
  onChange,
}: {
  calculator: TradeCalculatorState;
  tradeMath: TradeMath;
  onChange: <K extends TradeCalculatorField>(field: K, value: TradeCalculatorState[K]) => void;
}) {
  return (
    <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
      <CardContent className="space-y-4 p-5">
        <SectionTitle icon={<Calculator className="h-4 w-4" />} title="План конкретной сделки и расчёт лота" />

        <div className="grid gap-3 md:grid-cols-3">
          <TextInput label="Инструмент" value={calculator.symbol} setValue={(value) => onChange("symbol", value)} />
          <SelectInput label="Направление" value={calculator.direction} setValue={(value) => onChange("direction", value)} options={directionOptions} />
          <NumberInput label="Риск на сделку, $" value={calculator.riskDollars} setValue={(value) => onChange("riskDollars", value)} />
        </div>

        <label className="block">
          <div className="mb-1 text-sm">Причина входа</div>
          <textarea
            value={calculator.entryReason}
            onChange={(event) => onChange("entryReason", event.target.value)}
            placeholder="Например: ретест уровня, импульс, подтверждение объёмом, стоп за локальный экстремум"
            className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-4">
          <NumberInput label="Вход" value={calculator.entryPrice} setValue={(value) => onChange("entryPrice", value)} />
          <NumberInput label="Стоп" value={calculator.stopPrice} setValue={(value) => onChange("stopPrice", value)} />
          <NumberInput label="Тейк" value={calculator.takePrice} setValue={(value) => onChange("takePrice", value)} />
          <NumberInput label="$ за 1 пункт на 1 лот" value={calculator.dollarsPerPointPerLot} setValue={(value) => onChange("dollarsPerPointPerLot", value)} />
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Rule title="Лот" value={Number.isFinite(tradeMath.lots) ? tradeMath.lots.toFixed(2) : "—"} />
          <Rule title="Стоп, пунктов" value={tradeMath.stopDistance.toFixed(2)} />
          <Rule title="Потенциал" value={`$${tradeMath.rewardDollars.toFixed(0)}`} />
          <Rule title="R:R" value={tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
        </div>

        {!tradeMath.stopValid && <Warning text="Стоп стоит с неправильной стороны от входа." />}
        {!tradeMath.takeValid && <Warning text="Тейк стоит с неправильной стороны от входа." />}
        {calculator.entryReason.trim().length > 0 && calculator.entryReason.trim().length <= 8 && <Warning text="Причина входа слишком короткая. Это похоже на импульс, а не на план." />}
        {tradeMath.rr > 0 && tradeMath.rr < 1.5 && <Warning text="R:R ниже 1:1.5. Для тебя это повышенный риск эмоционального добора." />}
      </CardContent>
    </Card>
  );
}
