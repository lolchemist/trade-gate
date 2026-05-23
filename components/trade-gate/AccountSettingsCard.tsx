import { Landmark } from "lucide-react";
import { NumberInput } from "./form-controls";
import { PanelHeader, TerminalPanel } from "./terminal-ui";
import { formatCurrency } from "./utils";
import type { AccountSettings } from "./types";

export function AccountSettingsCard({
  settings,
  dailyLossUsed,
  totalLossUsed,
  profitProgress,
  onChange,
}: {
  settings: AccountSettings;
  dailyLossUsed: number;
  totalLossUsed: number;
  profitProgress: number;
  onChange: (field: keyof AccountSettings, value: string) => void;
}) {
  const personalDailyStop = Number(settings.personalDailyStop) || 0;
  const propDailyLossLimit = Number(settings.propDailyLossLimit) || 0;
  const maxLossLimit = Number(settings.maxLossLimit) || 0;
  const profitTarget = Number(settings.profitTarget) || 0;

  return (
    <TerminalPanel className="p-5" glow="neutral">
      <div className="space-y-4">
        <PanelHeader eyebrow="Настройки аккаунта" title="Правила проп-аккаунта" meta={<Landmark className="h-5 w-5 text-neutral-500" />} />
        <div className="grid gap-3 md:grid-cols-3">
          <NumberInput label="Размер аккаунта, $" value={settings.accountSize} setValue={(value) => onChange("accountSize", value)} />
          <NumberInput label="Дневной лимит проп-фирмы, $" value={settings.propDailyLossLimit} setValue={(value) => onChange("propDailyLossLimit", value)} />
          <NumberInput label="Личный дневной стоп, $" value={settings.personalDailyStop} setValue={(value) => onChange("personalDailyStop", value)} />
          <NumberInput label="Макс. риск на сделку, $" value={settings.personalMaxRiskPerTrade} setValue={(value) => onChange("personalMaxRiskPerTrade", value)} />
          <NumberInput label="Максимальный лимит убытка, $" value={settings.maxLossLimit} setValue={(value) => onChange("maxLossLimit", value)} />
          <NumberInput label="Личный максимальный убыток, $" value={settings.personalMaxLoss} setValue={(value) => onChange("personalMaxLoss", value)} />
          <NumberInput label="Цель по прибыли, $" value={settings.profitTarget} setValue={(value) => onChange("profitTarget", value)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ProgressRow title="До личного дневного стопа" used={dailyLossUsed} limit={personalDailyStop} />
          <ProgressRow title="До дневного лимита проп-фирмы" used={dailyLossUsed} limit={propDailyLossLimit} />
          <ProgressRow title="До максимального убытка" used={totalLossUsed} limit={maxLossLimit} />
          <ProgressRow title="Прогресс к цели прибыли" used={profitProgress} limit={profitTarget} positive />
        </div>
      </div>
    </TerminalPanel>
  );
}

function ProgressRow({ title, used, limit, positive = false }: { title: string; used: number; limit: number; positive?: boolean }) {
  const percent = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-neutral-300">{title}</span>
        <span className="font-mono text-neutral-200">
          {formatCurrency(used)} / {formatCurrency(limit)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${positive ? "bg-emerald-200/80" : percent >= 80 ? "bg-rose-200/75" : "bg-amber-100/75"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
