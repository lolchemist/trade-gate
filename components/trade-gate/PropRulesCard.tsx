import { Landmark } from "lucide-react";
import { formatCurrency } from "./utils";
import { MetricTile, PanelHeader, ProgressMeter, TerminalPanel } from "./terminal-ui";
import type { AccountSettings } from "./types";

export function PropRulesCard({
  settings,
  dailyLossUsed,
  totalLossUsed,
  profitProgress,
  compact = false,
}: {
  settings: AccountSettings;
  dailyLossUsed: number;
  totalLossUsed: number;
  profitProgress: number;
  compact?: boolean;
}) {
  const personalDailyStop = Number(settings.personalDailyStop) || 0;
  const propDailyLossLimit = Number(settings.propDailyLossLimit) || 0;
  const personalMaxLoss = Number(settings.personalMaxLoss) || 0;
  const maxLossLimit = Number(settings.maxLossLimit) || 0;
  const profitTarget = Number(settings.profitTarget) || 0;
  const effectiveMaxLoss = personalMaxLoss > 0 ? Math.min(personalMaxLoss, maxLossLimit || personalMaxLoss) : maxLossLimit;

  return (
    <TerminalPanel className="p-5" glow={dailyLossUsed >= personalDailyStop && personalDailyStop > 0 ? "red" : dailyLossUsed >= propDailyLossLimit * 0.8 && propDailyLossLimit > 0 ? "amber" : "neutral"}>
      <PanelHeader eyebrow="Проп-лимиты" title="Лимиты аккаунта" meta={<Landmark className="h-5 w-5 text-neutral-500" />} />
      <div className="mt-5 grid gap-5">
        <ProgressMeter label="До личного дневного стопа" value={dailyLossUsed} max={Math.max(personalDailyStop, 1)} detail={`${formatCurrency(dailyLossUsed)} / ${formatCurrency(personalDailyStop)}`} tone="amber" inverse />
        <ProgressMeter label="До лимита проп-фирмы" value={dailyLossUsed} max={Math.max(propDailyLossLimit, 1)} detail={`${formatCurrency(dailyLossUsed)} / ${formatCurrency(propDailyLossLimit)}`} tone="amber" inverse />
        <ProgressMeter label="До максимального убытка" value={totalLossUsed} max={Math.max(effectiveMaxLoss, 1)} detail={`${formatCurrency(totalLossUsed)} / ${formatCurrency(effectiveMaxLoss)}`} tone="red" inverse />
        <ProgressMeter label="Прогресс к профит-таргету" value={profitProgress} max={Math.max(profitTarget, 1)} detail={`${formatCurrency(profitProgress)} / ${formatCurrency(profitTarget)}`} tone="emerald" />
      </div>
      {!compact && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MetricTile label="Размер" value={formatCurrency(Number(settings.accountSize) || 0)} />
          <MetricTile label="Личный лимит убытка" value={formatCurrency(personalMaxLoss)} />
          <MetricTile label="Цель прибыли" value={formatCurrency(profitTarget)} tone="emerald" />
        </div>
      )}
    </TerminalPanel>
  );
}
