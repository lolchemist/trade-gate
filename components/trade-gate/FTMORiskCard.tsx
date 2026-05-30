import { Clock3, Landmark, ShieldCheck } from "lucide-react";
import { NumberInput, SectionTitle } from "./form-controls";
import { MetricTile, PanelHeader, ProgressMeter, StatusPill, TerminalPanel } from "./terminal-ui";
import { formatCurrency } from "./utils";
import type { FTMODailyState, FTMORiskMetrics, FTMOSettings } from "./types";

export function FTMORiskCard({
  settings,
  dailyState,
  metrics,
  ftmoTradingDay,
  ftmoTimeLabel,
  localTimeLabel,
  localResetTimeLabel,
  timeUntilReset,
  isWithinTwoHoursOfReset,
  onDailyStateChange,
}: {
  settings: FTMOSettings;
  dailyState: FTMODailyState;
  metrics: FTMORiskMetrics;
  ftmoTradingDay: string;
  ftmoTimeLabel?: string;
  localTimeLabel?: string;
  localResetTimeLabel?: string;
  timeUntilReset?: string;
  isWithinTwoHoursOfReset?: boolean;
  onDailyStateChange: (field: keyof FTMODailyState, value: FTMODailyState[keyof FTMODailyState]) => void;
}) {
  const dailyLossTone = metrics.ftmoDailyLossHit ? "red" : metrics.nearFtmoDailyLimit ? "amber" : "emerald";
  const targetLabel = settings.challengePhase === "Funded" ? "Payout target" : `${settings.challengePhase} target`;

  return (
    <TerminalPanel className="p-5" glow={dailyLossTone}>
      <PanelHeader eyebrow="FTMO 2-Step" title="FTMO риск и reset" meta={<Landmark className="h-5 w-5 text-neutral-500" />} />

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill tone="cyan">FTMO day {ftmoTradingDay}</StatusPill>
        <StatusPill tone={isWithinTwoHoursOfReset ? "amber" : "neutral"}>Reset через {timeUntilReset ?? "—"}</StatusPill>
        <StatusPill tone={dailyLossTone}>Buffer {formatCurrency(metrics.safetyBuffer)}</StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MetricTile label="FTMO время" value={ftmoTimeLabel ?? "—"} detail={settings.ftmoTimezone} tone="cyan" />
        <MetricTile label="Локальное время" value={localTimeLabel ?? "—"} detail="Mexico City" />
        <MetricTile label="Reset локально" value={localResetTimeLabel ?? "—"} detail="следующий reset" tone={isWithinTwoHoursOfReset ? "amber" : "neutral"} />
        <MetricTile label="Эффективный день" value={formatCurrency(metrics.effectiveDailyPnl)} detail="консервативный PnL" tone={metrics.effectiveDailyPnl >= 0 ? "emerald" : "red"} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ProgressMeter
          label="Личный дневной стоп"
          value={metrics.personalDailyStopUsed}
          max={Math.max(Number(settings.personalDailyStop) || 1, 1)}
          detail={`${formatCurrency(metrics.personalDailyStopUsed)} / ${formatCurrency(Number(settings.personalDailyStop) || 0)}`}
          tone="amber"
          inverse
        />
        <ProgressMeter
          label="FTMO daily loss"
          value={metrics.ftmoDailyLossUsed + metrics.safetyBuffer}
          max={Math.max(metrics.ftmoMaxDailyLossAmount, 1)}
          detail={`${formatCurrency(metrics.remainingFtmoDailyRiskAfterBuffer)} осталось после buffer`}
          tone="amber"
          inverse
        />
        <ProgressMeter
          label="Distance to max loss"
          value={Math.max(0, metrics.ftmoMaxLossAmount - metrics.distanceToMaxLoss)}
          max={Math.max(metrics.ftmoMaxLossAmount, 1)}
          detail={`${formatCurrency(metrics.distanceToMaxLoss)} до нарушения`}
          tone="red"
          inverse
        />
        <ProgressMeter
          label={targetLabel}
          value={metrics.profitTargetProgress}
          max={Math.max(metrics.profitTarget, 1)}
          detail={metrics.profitTarget > 0 ? `${formatCurrency(metrics.remainingToTarget)} осталось` : "не задан"}
          tone="emerald"
        />
      </div>

      {(isWithinTwoHoursOfReset || metrics.effectiveDailyLoss < 0) && (
        <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.06] p-4 text-sm leading-relaxed text-amber-100/90">
          <div className="flex items-center gap-2 font-semibold">
            <Clock3 className="h-4 w-4" />
            FTMO reset awareness
          </div>
          <p className="mt-2 text-amber-100/75">
            FTMO reset приближается. Если floating PnL отрицательный, он может уменьшить доступный daily loss после reset. Держи safety buffer и не планируй риск впритык.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Ручной FTMO daily state" />
        <div className="grid gap-3 md:grid-cols-3">
          <NumberInput label="Start balance" value={dailyState.startOfDayBalance} setValue={(value) => onDailyStateChange("startOfDayBalance", value)} />
          <NumberInput label="Start equity" value={dailyState.startOfDayEquity} setValue={(value) => onDailyStateChange("startOfDayEquity", value)} />
          <NumberInput label="Current balance" value={dailyState.currentBalance} setValue={(value) => onDailyStateChange("currentBalance", value)} />
          <NumberInput label="Current equity" value={dailyState.currentEquity} setValue={(value) => onDailyStateChange("currentEquity", value)} />
          <NumberInput label="Closed PnL today" value={dailyState.closedPnlToday} setValue={(value) => onDailyStateChange("closedPnlToday", value)} />
          <NumberInput label="Floating PnL" value={dailyState.floatingPnl} setValue={(value) => onDailyStateChange("floatingPnl", value)} />
          <NumberInput label="Commissions" value={dailyState.commissions} setValue={(value) => onDailyStateChange("commissions", value)} />
          <NumberInput label="Swaps" value={dailyState.swaps} setValue={(value) => onDailyStateChange("swaps", value)} />
          <NumberInput label="Deposits/withdrawals adj." value={dailyState.depositsWithdrawalsAdjustment} setValue={(value) => onDailyStateChange("depositsWithdrawalsAdjustment", value)} />
        </div>
      </div>
    </TerminalPanel>
  );
}
