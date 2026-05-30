import { Settings2 } from "lucide-react";
import { NumberInput, SelectInput, Toggle } from "./form-controls";
import { PanelHeader, TerminalPanel } from "./terminal-ui";
import type { FTMOChallengePhase, FTMOSettings, LocalSessionSettings } from "./types";

const phaseOptions = [
  { value: "Phase 1" as const, label: "Phase 1" },
  { value: "Phase 2" as const, label: "Phase 2" },
  { value: "Funded" as const, label: "Funded" },
];

const weekdayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

export function FTMOSettingsCard({
  ftmoSettings,
  localSessionSettings,
  onFtmoChange,
  onLocalSessionChange,
}: {
  ftmoSettings: FTMOSettings;
  localSessionSettings: LocalSessionSettings;
  onFtmoChange: (field: keyof FTMOSettings, value: FTMOSettings[keyof FTMOSettings]) => void;
  onLocalSessionChange: (field: keyof LocalSessionSettings, value: LocalSessionSettings[keyof LocalSessionSettings]) => void;
}) {
  const activeDays = new Set(localSessionSettings.activeTradingDays);

  return (
    <TerminalPanel className="p-5" glow="cyan">
      <PanelHeader eyebrow="FTMO settings" title="FTMO 2-Step и локальная сессия" meta={<Settings2 className="h-5 w-5 text-neutral-500" />} />

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SelectInput<FTMOChallengePhase> label="Фаза челленджа" value={ftmoSettings.challengePhase} setValue={(value) => onFtmoChange("challengePhase", value)} options={phaseOptions} />
        <NumberInput label="Размер аккаунта, $" value={ftmoSettings.accountSize} setValue={(value) => onFtmoChange("accountSize", value)} />
        <NumberInput label="Safety buffer, $" value={ftmoSettings.safetyBuffer} setValue={(value) => onFtmoChange("safetyBuffer", value)} />
        <TextField label="FTMO timezone" value={ftmoSettings.ftmoTimezone} setValue={(value) => onFtmoChange("ftmoTimezone", value)} />
        <TextField label="FTMO reset time" value={ftmoSettings.ftmoResetTime} setValue={(value) => onFtmoChange("ftmoResetTime", value)} />
        <NumberInput label="Minimum trading days" value={ftmoSettings.minimumTradingDays} setValue={(value) => onFtmoChange("minimumTradingDays", value)} />
        <NumberInput label="Max daily loss, %" value={ftmoSettings.maxDailyLossPercent} setValue={(value) => onFtmoChange("maxDailyLossPercent", value)} />
        <NumberInput label="Max loss, %" value={ftmoSettings.maxLossPercent} setValue={(value) => onFtmoChange("maxLossPercent", value)} />
        <NumberInput label="Personal daily stop, $" value={ftmoSettings.personalDailyStop} setValue={(value) => onFtmoChange("personalDailyStop", value)} />
        <NumberInput label="Phase 1 target, %" value={ftmoSettings.phase1ProfitTargetPercent} setValue={(value) => onFtmoChange("phase1ProfitTargetPercent", value)} />
        <NumberInput label="Phase 2 target, %" value={ftmoSettings.phase2ProfitTargetPercent} setValue={(value) => onFtmoChange("phase2ProfitTargetPercent", value)} />
        <NumberInput label="Funded payout target, $" value={ftmoSettings.fundedProfitTarget} setValue={(value) => onFtmoChange("fundedProfitTarget", value)} />
        <NumberInput label="Personal max loss, $" value={ftmoSettings.personalMaxLoss} setValue={(value) => onFtmoChange("personalMaxLoss", value)} />
        <NumberInput label="Max risk per trade, $" value={ftmoSettings.personalMaxRiskPerTrade} setValue={(value) => onFtmoChange("personalMaxRiskPerTrade", value)} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <TextField label="Local timezone" value={localSessionSettings.localTimezone} setValue={(value) => onLocalSessionChange("localTimezone", value)} />
        <TextField label="Session start" value={localSessionSettings.localSessionStart} setValue={(value) => onLocalSessionChange("localSessionStart", value)} />
        <TextField label="Session end" value={localSessionSettings.localSessionEnd} setValue={(value) => onLocalSessionChange("localSessionEnd", value)} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Toggle label="Пропускать выходные" value={localSessionSettings.skipWeekends} setValue={(value) => onLocalSessionChange("skipWeekends", value)} />
        <Toggle label="Разрешить after-hours trading" value={localSessionSettings.allowAfterHoursTrading} setValue={(value) => onLocalSessionChange("allowAfterHoursTrading", value)} />
        <Toggle label="Best Day Rule tracking" value={ftmoSettings.bestDayRuleEnabled} setValue={(value) => onFtmoChange("bestDayRuleEnabled", value)} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Активные торговые дни</div>
        <div className="flex flex-wrap gap-2">
          {weekdayOptions.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => {
                const next = activeDays.has(day.value)
                  ? localSessionSettings.activeTradingDays.filter((value) => value !== day.value)
                  : [...localSessionSettings.activeTradingDays, day.value].sort();
                onLocalSessionChange("activeTradingDays", next);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                activeDays.has(day.value)
                  ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"
                  : "border-white/10 bg-white/[0.035] text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>
    </TerminalPanel>
  );
}

function TextField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-neutral-300">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
      />
    </label>
  );
}
