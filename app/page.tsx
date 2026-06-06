"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Lock, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, INSTRUMENT_DEFAULTS, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import { MIN_SCENARIO_RR } from "@/constants/trade-gate";
import { useBehavioralRiskEngine } from "@/hooks/trade-gate/useBehavioralRiskEngine";
import { useFtmoClock } from "@/hooks/trade-gate/useFtmoClock";
import { useLocalStoragePersistence } from "@/hooks/trade-gate/useLocalStoragePersistence";
import { useSupabaseSync } from "@/hooks/trade-gate/useSupabaseSync";
import { initialPlanningState, useTradeGateState } from "@/hooks/trade-gate/useTradeGateState";
import { useTodayMetrics } from "@/hooks/trade-gate/useTodayMetrics";
import { calculateFtmoRiskMetrics, getFtmoDailyState } from "@/lib/ftmoRisk";
import {
  calculateScenarioExecutionRisk,
  calculateScenarioTradeMath,
  formatCurrency,
  formatSyncStatus,
  getRiskControlsForDate,
  getScenarioTrades,
  validateScenarioPlan,
} from "@/components/trade-gate/utils";
import type { Direction, ResultStatus, SessionPlan, TradeExecutionStatus } from "@/types/trade-gate";

type AppScreen = "gate" | "idea" | "trade" | "review";

type ReviewState = {
  byPlan: boolean;
  stopMoved: boolean;
  emotions: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const LOSS_REASONS = [
  "попытка отбить убыток",
  "увеличение объёма после прибыли",
  "вход без плана",
  "торговля после двух стопов",
  "FOMO-вход",
  "усреднение против позиции",
];

const resultOptions: { status: TradeExecutionStatus; label: string; tone: "good" | "bad" | "neutral" }[] = [
  { status: "take", label: "Тейк", tone: "good" },
  { status: "stop", label: "Стоп", tone: "bad" },
  { status: "breakeven", label: "Безубыток", tone: "neutral" },
  { status: "manual_profit", label: "Ручное +", tone: "good" },
  { status: "manual_loss", label: "Ручное -", tone: "bad" },
];

export default function TradeGateApp() {
  const storage = useLocalStoragePersistence({ supabaseUrl, supabaseAnonKey });
  const [planning, dispatchPlanning] = useTradeGateState();
  const [screen, setScreen] = useState<AppScreen>("gate");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [lossCheckConfirmed, setLossCheckConfirmed] = useState(false);
  const [review, setReview] = useState<ReviewState>({ byPlan: true, stopMoved: false, emotions: false });
  const [nowMs, setNowMs] = useState<number | null>(null);

  const {
    sessionPlans,
    archivedPlans,
    dailyRiskBudgets,
    riskControlsByDate,
    controlSessionDate: storedControlSessionDate,
    ftmoSettings,
    localSessionSettings,
    ftmoDailyStateByFtmoTradingDay,
    accountSettings,
    activePlanDate,
  } = planning;

  const storageSync = useSupabaseSync({
    storage,
    planning,
    dispatchPlanning,
    initialPlanningState,
  });
  const { appStatus, isHydrated, isCloudLoaded, isInitialSyncComplete, syncStatus, setSyncStatus, saveNow } = storageSync;
  const isTradingStateReady = isHydrated && isCloudLoaded && isInitialSyncComplete;

  const ftmoClock = useFtmoClock(ftmoSettings, localSessionSettings, isHydrated);
  const ftmoTradingDay = ftmoClock?.ftmoTradingDay ?? activePlanDate;
  const localTradingSessionDate = ftmoClock?.localTradingSessionDate ?? activePlanDate;
  const controlSessionDate = storedControlSessionDate || localTradingSessionDate || activePlanDate;
  const activeRiskControls = getRiskControlsForDate(riskControlsByDate, controlSessionDate);
  const ftmoDailyState = getFtmoDailyState(ftmoDailyStateByFtmoTradingDay, ftmoTradingDay, ftmoSettings.accountSize);
  const ftmoRisk = calculateFtmoRiskMetrics(ftmoSettings, ftmoDailyState);
  const todayMetrics = useTodayMetrics(activePlanDate, sessionPlans, archivedPlans, dailyRiskBudgets, accountSettings);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    const timeout = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || !ftmoClock) return;
    if (storedControlSessionDate !== ftmoClock.localTradingSessionDate) {
      dispatchPlanning({ type: "set-control-session-date", controlSessionDate: ftmoClock.localTradingSessionDate });
    }
    if (!ftmoDailyStateByFtmoTradingDay[ftmoClock.ftmoTradingDay]) {
      dispatchPlanning({ type: "set-ftmo-daily-state", ftmoTradingDay: ftmoClock.ftmoTradingDay, field: "ftmoTradingDay", value: ftmoClock.ftmoTradingDay });
    }
  }, [dispatchPlanning, ftmoClock, ftmoDailyStateByFtmoTradingDay, isHydrated, storedControlSessionDate]);

  const plansForDate = useMemo(() => sessionPlans.filter((plan) => plan.planDate === activePlanDate), [activePlanDate, sessionPlans]);
  const latestActiveIdea = useMemo(
    () => [...plansForDate].filter((plan) => plan.status !== "closed" && plan.status !== "archived").sort((a, b) => b.id - a.id)[0] ?? null,
    [plansForDate]
  );
  const latestPlanForDate = useMemo(() => [...plansForDate].sort((a, b) => b.id - a.id)[0] ?? null, [plansForDate]);
  const screenIdea = useMemo(
    () => plansForDate.find((plan) => plan.id === selectedPlanId) ?? latestActiveIdea ?? latestPlanForDate,
    [latestActiveIdea, latestPlanForDate, plansForDate, selectedPlanId]
  );
  const screenTrade = screenIdea ? getScenarioTrades(screenIdea)[0] : undefined;
  const maxRiskPerTrade = Number(accountSettings.personalMaxRiskPerTrade) || Number(ftmoSettings.personalMaxRiskPerTrade) || 500;
  const plannedRisk = Math.max(0, Number(screenIdea?.tradeRisk) || maxRiskPerTrade);
  const remainingFtmoRisk = Math.max(0, Math.min(ftmoRisk.remainingPersonalDailyRisk, ftmoRisk.remainingFtmoDailyRiskAfterBuffer));
  const allowedRisk = Math.max(0, Math.min(maxRiskPerTrade, Math.max(0, todayMetrics.remainingRisk), remainingFtmoRisk));
  const ideaForMath = screenIdea
    ? {
        ...screenIdea,
        tradeRisk: String(plannedRisk),
        tradePointValue: screenIdea.tradePointValue || getPointValuePerLot(screenIdea.symbol),
      }
    : null;
  const tradeMath = ideaForMath ? calculateScenarioTradeMath(ideaForMath) : null;
  const validation = ideaForMath
    ? validateScenarioPlan(ideaForMath, {
        minimumRr: MIN_SCENARIO_RR,
        personalMaxRiskPerTrade: maxRiskPerTrade,
        remainingDailyRisk: Math.max(0, todayMetrics.remainingRisk),
        remainingPersonalDailyRisk: ftmoRisk.remainingPersonalDailyRisk,
        remainingFtmoDailyRiskAfterBuffer: ftmoRisk.remainingFtmoDailyRiskAfterBuffer,
      })
    : null;

  const behavioralRisk = useBehavioralRiskEngine({
    activePlanDate,
    sessionPlans,
    archivedPlans,
    riskControls: activeRiskControls,
    todayMetrics,
    accountSettings,
  });

  const lockUntilMs = activeRiskControls.lockUntil ? Date.parse(String(activeRiskControls.lockUntil)) : 0;
  const lockUntilActive = Boolean(nowMs && lockUntilMs > nowMs);
  const gateReasons = (() => {
    const reasons: string[] = [];
    if (!isTradingStateReady) reasons.push("проверяю сохранённое состояние");
    if (lockUntilActive) reasons.push("активна временная блокировка");
    if (activeRiskControls.revenge) reasons.push("включено желание отбиться");
    if (todayMetrics.remainingRisk <= 0 || ftmoRisk.personalDailyStopHit || ftmoRisk.ftmoDailyLossHit) reasons.push("достигнут дневной лимит");
    if (ftmoRisk.maxLossBreached) reasons.push("достигнут максимальный лимит убытка");
    if (todayMetrics.consecutiveStops >= 2) reasons.push("2 стопа подряд");
    if (behavioralRisk.state === "RED") reasons.push("эмоциональный риск слишком высокий");
    if (!latestActiveIdea) {
      reasons.push("нет активного плана сделки");
    } else if (validation) {
      reasons.push(...validation.reasons);
    }
    if (plannedRisk > allowedRisk) reasons.push("превышен риск");
    return [...new Set(reasons)];
  })();
  const canTrade = gateReasons.length === 0;
  const canConfirmIdea = Boolean(validation?.valid && lossCheckConfirmed && plannedRisk <= allowedRisk && isTradingStateReady);

  const updateIdea = <K extends keyof SessionPlan>(field: K, value: SessionPlan[K]) => {
    if (!screenIdea) return;
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field, value });
  };

  const startNewIdea = () => {
    if (!latestActiveIdea) {
      dispatchPlanning({ type: "add-plan", symbol: DEFAULT_INSTRUMENT_SYMBOL });
      setSelectedPlanId(null);
    } else {
      setSelectedPlanId(latestActiveIdea.id);
    }
    setLossCheckConfirmed(false);
    setScreen("idea");
  };

  const confirmIdea = () => {
    if (!screenIdea || !canConfirmIdea) return;
    const confirmed = window.confirm("Эта сделка не повторяет один из сценариев моего предыдущего слива?");
    if (!confirmed) return;

    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "tradeRisk", value: String(plannedRisk) });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "entryZone", value: screenIdea.tradeEntry });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "stop", value: screenIdea.tradeStop });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "take", value: screenIdea.tradeTake });
    if (getScenarioTrades(screenIdea).length === 0) {
      dispatchPlanning({ type: "add-trade", scenarioId: screenIdea.id, executionType: "trade_1" });
    }
    setSelectedPlanId(screenIdea.id);
    setScreen("trade");
    void saveNow();
  };

  const markTradeStatus = (status: TradeExecutionStatus) => {
    if (!screenIdea || !screenTrade) return;
    const executionMath = calculateScenarioExecutionRisk(screenIdea, screenTrade);
    const result = getResultForStatus(status, executionMath.risk, executionMath.potential);
    dispatchPlanning({ type: "update-trade", scenarioId: screenIdea.id, tradeId: screenTrade.id, field: "status", value: status });
    dispatchPlanning({ type: "update-trade", scenarioId: screenIdea.id, tradeId: screenTrade.id, field: "actualResult", value: result });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "resultStatus", value: normalizeResultStatus(status) });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "finalResult", value: result });
    if (status !== "executed" && status !== "planned") {
      dispatchPlanning({ type: "close-plan", id: screenIdea.id });
      setScreen("review");
    }
  };

  const saveReview = () => {
    if (!screenIdea || !screenTrade) return;
    const note = [
      `По плану: ${review.byPlan ? "да" : "нет"}`,
      `Стоп переносился: ${review.stopMoved ? "да" : "нет"}`,
      `Эмоции: ${review.emotions ? "да" : "нет"}`,
    ].join(" · ");
    dispatchPlanning({ type: "update-trade", scenarioId: screenIdea.id, tradeId: screenTrade.id, field: "technical", value: review.byPlan && !review.stopMoved && !review.emotions ? "yes" : review.byPlan ? "partial" : "no" });
    dispatchPlanning({ type: "update-trade", scenarioId: screenIdea.id, tradeId: screenTrade.id, field: "executionNotes", value: note });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "technical", value: review.byPlan && !review.stopMoved && !review.emotions ? "yes" : review.byPlan ? "partial" : "no" });
    dispatchPlanning({ type: "update-plan", id: screenIdea.id, field: "closeComment", value: note });
    setScreen("gate");
    void saveNow();
  };

  if (!isHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111111] p-4 text-neutral-100">
        <Panel className="max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
            <ShieldCheck className="h-6 w-6 text-neutral-300" />
          </div>
          <div className="text-2xl font-semibold">Проверяю состояние</div>
          <div className="mt-2 text-sm text-neutral-500">{formatSyncStatus(syncStatus)}</div>
        </Panel>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] px-4 py-5 text-neutral-100 md:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/[0.08] bg-[#171717] p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Trade Gate</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Допуск к сделке</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{activePlanDate}</span>
            <span>·</span>
            <span>{formatSyncStatus(syncStatus)}</span>
            {appStatus === "syncing" && <span>· синхронизация</span>}
          </div>
        </header>

        <nav className="grid gap-2 sm:grid-cols-4">
          <NavButton active={screen === "gate"} label="Допуск" onClick={() => setScreen("gate")} />
          <NavButton active={screen === "idea"} label="Новая идея" onClick={startNewIdea} />
          <NavButton active={screen === "trade"} label="Активная сделка" onClick={() => setScreen("trade")} />
          <NavButton active={screen === "review"} label="Разбор" onClick={() => setScreen("review")} />
        </nav>

        <LossReasons />

        {screen === "gate" && (
          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <Panel className={canTrade ? "border-emerald-200/20" : "border-rose-200/20"}>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${canTrade ? "bg-emerald-300/[0.09] text-emerald-100" : "bg-rose-300/[0.09] text-rose-100"}`}>
                    {canTrade ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {canTrade ? "Можно торговать" : "Торговля запрещена"}
                  </div>
                  <div className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
                    {canTrade ? "Открывать можно" : "Стоп"}
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
                    Решение строится только на риске, дисциплине и наличии готового плана. Всё остальное скрыто.
                  </p>
                </div>
                <Button onClick={startNewIdea} className="h-14 rounded-2xl bg-neutral-100 px-6 text-base font-semibold text-neutral-950 hover:bg-white">
                  Новая идея
                </Button>
              </div>

              <div className="mt-6">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Причины</div>
                {gateReasons.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.06] p-4 text-sm text-emerald-100">
                    Блокирующих причин нет. Не добавляй сделку, если она похожа на один из сценариев слива.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {gateReasons.map((reason) => (
                      <div key={reason} className="flex items-start gap-2 rounded-2xl border border-rose-200/15 bg-rose-200/[0.06] p-3 text-sm text-rose-100">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Сегодня</div>
              <div className="mt-4 grid gap-3">
                <Metric label="PnL дня" value={formatCurrency(todayMetrics.realizedPnl)} tone={todayMetrics.realizedPnl >= 0 ? "good" : "bad"} />
                <Metric label="Остаток дневного риска" value={formatCurrency(Math.max(0, todayMetrics.remainingRisk))} tone={todayMetrics.remainingRisk > 0 ? "good" : "bad"} />
                <Metric label="Сделок" value={String(todayMetrics.tradesToday)} />
                <Metric label="Стопы подряд" value={String(todayMetrics.consecutiveStops)} tone={todayMetrics.consecutiveStops >= 2 ? "bad" : todayMetrics.consecutiveStops === 1 ? "warn" : "neutral"} />
              </div>
              <Button
                type="button"
                onClick={() => {
                  const until = new Date();
                  until.setHours(until.getHours() + 2);
                  dispatchPlanning({ type: "set-emergency-lock", revenge: true, lockUntil: until.toISOString(), planDate: controlSessionDate });
                  setSyncStatus("Блокировка включена на 2 часа");
                }}
                variant="outline"
                className="mt-4 w-full rounded-2xl border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]"
              >
                Я хочу отбиться
              </Button>
            </Panel>
          </div>
        )}

        {screen === "idea" && (
          <Panel>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Новая идея</div>
                <h2 className="mt-1 text-2xl font-semibold">Только то, что влияет на допуск</h2>
              </div>
              <StatusChip allowed={canConfirmIdea} label={canConfirmIdea ? "Сделка разрешена" : "Сделка запрещена"} />
            </div>

            {!screenIdea ? (
              <EmptyState text="Нет активной идеи. Нажми “Новая идея” ещё раз." />
            ) : (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Инструмент"
                    value={screenIdea.symbol}
                    onChange={(value) => updateIdea("symbol", normalizeInstrumentSymbol(value))}
                    options={Object.keys(INSTRUMENT_DEFAULTS).map((symbol) => ({ value: symbol, label: symbol }))}
                  />
                  <SelectField
                    label="Направление"
                    value={screenIdea.direction}
                    onChange={(value) => updateIdea("direction", value as Direction)}
                    options={[
                      { value: "long", label: "Long" },
                      { value: "short", label: "Short" },
                    ]}
                  />
                  <NumberField
                    label="Вход"
                    value={screenIdea.tradeEntry}
                    onChange={(value) => {
                      updateIdea("tradeEntry", value);
                      updateIdea("entryZone", value);
                    }}
                  />
                  <NumberField
                    label="Стоп"
                    value={screenIdea.tradeStop}
                    onChange={(value) => {
                      updateIdea("tradeStop", value);
                      updateIdea("stop", value);
                    }}
                  />
                  <NumberField
                    label="Цель"
                    value={screenIdea.tradeTake}
                    onChange={(value) => {
                      updateIdea("tradeTake", value);
                      updateIdea("take", value);
                    }}
                  />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <Metric label="Риск" value={formatCurrency(plannedRisk)} tone={plannedRisk <= allowedRisk ? "good" : "bad"} />
                  <Metric label="RR" value={tradeMath && tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} tone={tradeMath && tradeMath.rr >= MIN_SCENARIO_RR ? "good" : "bad"} />
                  <Metric label="Позиция" value={tradeMath && tradeMath.lot > 0 ? `${tradeMath.lot.toFixed(2)} lot` : "—"} />
                </div>

                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-300">
                    <input
                      type="checkbox"
                      checked={lossCheckConfirmed}
                      onChange={(event) => setLossCheckConfirmed(event.target.checked)}
                      className="mt-1 h-4 w-4 accent-emerald-300"
                    />
                    <span>Эта сделка не повторяет один из сценариев моего предыдущего слива.</span>
                  </label>
                </div>

                {validation && validation.reasons.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {validation.reasons.map((reason) => (
                      <div key={reason} className="rounded-2xl border border-rose-200/15 bg-rose-200/[0.06] p-3 text-sm text-rose-100">
                        {reason}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={confirmIdea} disabled={!canConfirmIdea} className="h-12 rounded-2xl bg-neutral-100 px-5 font-semibold text-neutral-950 hover:bg-white disabled:opacity-40">
                    Подтвердить идею
                  </Button>
                  <Button onClick={() => setScreen("gate")} variant="outline" className="h-12 rounded-2xl border-white/10 bg-black/20 text-neutral-200 hover:bg-white/[0.06]">
                    Назад к допуску
                  </Button>
                </div>
              </>
            )}
          </Panel>
        )}

        {screen === "trade" && (
          <Panel>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Активная сделка</div>
            {!screenIdea ? (
              <EmptyState text="Нет активной сделки." />
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Metric label="Инструмент" value={screenIdea.symbol} />
                  <Metric label="Направление" value={screenIdea.direction.toUpperCase()} />
                  <Metric label="Риск" value={formatCurrency(plannedRisk)} />
                  <Metric label="RR" value={tradeMath && tradeMath.rr > 0 ? `1:${tradeMath.rr.toFixed(2)}` : "—"} />
                </div>
                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="mb-3 text-sm text-neutral-400">Текущий статус</div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => markTradeStatus("executed")} variant="outline" className="rounded-xl border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/[0.08]">
                      Активна
                    </Button>
                    {resultOptions.map((option) => (
                      <Button
                        key={option.status}
                        onClick={() => markTradeStatus(option.status)}
                        variant="outline"
                        className={`rounded-xl ${
                          option.tone === "good"
                            ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100 hover:bg-emerald-200/[0.1]"
                            : option.tone === "bad"
                              ? "border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]"
                              : "border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/[0.08]"
                        }`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Panel>
        )}

        {screen === "review" && (
          <Panel>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Разбор сделки</div>
            <div className="mt-5 grid gap-3">
              <BooleanQuestion label="Сделка была по плану?" value={review.byPlan} onChange={(value) => setReview((current) => ({ ...current, byPlan: value }))} />
              <BooleanQuestion label="Стоп переносился?" value={review.stopMoved} onChange={(value) => setReview((current) => ({ ...current, stopMoved: value }))} />
              <BooleanQuestion label="Были эмоции?" value={review.emotions} onChange={(value) => setReview((current) => ({ ...current, emotions: value }))} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={saveReview} className="h-12 rounded-2xl bg-neutral-100 px-5 font-semibold text-neutral-950 hover:bg-white">
                Сохранить ответ
              </Button>
              <Button onClick={() => setScreen("gate")} variant="outline" className="h-12 rounded-2xl border-white/10 bg-black/20 text-neutral-200 hover:bg-white/[0.06]">
                Без сохранения
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/[0.08] bg-[#171717] p-5 shadow-xl shadow-black/20 ${className}`}>{children}</section>;
}

function NavButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active ? "border-neutral-200/20 bg-neutral-100 text-neutral-950" : "border-white/[0.08] bg-[#171717] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-100"
      }`}
    >
      {label}
    </button>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "good" | "bad" | "warn" | "neutral" }) {
  const toneClass = tone === "good" ? "text-emerald-100" : tone === "bad" ? "text-rose-100" : tone === "warn" ? "text-amber-100" : "text-neutral-100";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusChip({ allowed, label }: { allowed: boolean; label: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${allowed ? "bg-emerald-300/[0.09] text-emerald-100" : "bg-rose-300/[0.09] text-rose-100"}`}>
      {allowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {label}
    </div>
  );
}

function LossReasons() {
  return (
    <Panel>
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
        <AlertTriangle className="h-4 w-4" />
        Мои причины слива
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {LOSS_REASONS.map((reason) => (
          <span key={reason} className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-sm text-neutral-300">
            {reason}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/20 p-4 text-sm text-neutral-500">{text}</div>;
}

function NumberField({ label, value, onChange }: { label: string; value: string | number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-neutral-400">{label}</div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          const raw = event.target.value.replace(",", ".");
          if (/^-?\d*\.?\d*$/.test(raw)) onChange(raw);
        }}
        className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 text-neutral-100 outline-none focus:border-neutral-200/30"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-neutral-400">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 text-neutral-100 outline-none focus:border-neutral-200/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-neutral-950 text-neutral-100">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BooleanQuestion({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-base font-medium text-neutral-100">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${value ? "border-emerald-200/20 bg-emerald-200/[0.08] text-emerald-100" : "border-white/[0.08] text-neutral-400"}`}
        >
          Да
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${!value ? "border-rose-200/20 bg-rose-200/[0.08] text-rose-100" : "border-white/[0.08] text-neutral-400"}`}
        >
          Нет
        </button>
      </div>
    </div>
  );
}

function getResultForStatus(status: TradeExecutionStatus, risk: number, potential: number) {
  if (status === "take") return formatNumberForState(potential);
  if (status === "stop") return formatNumberForState(-risk);
  if (status === "manual_profit") return formatNumberForState(potential > 0 ? potential / 2 : 0);
  if (status === "manual_loss") return formatNumberForState(risk > 0 ? -risk / 2 : 0);
  return "0";
}

function normalizeResultStatus(status: TradeExecutionStatus): ResultStatus {
  if (status === "take" || status === "stop" || status === "manual_profit" || status === "manual_loss" || status === "breakeven") return status;
  return "not_taken";
}

function formatNumberForState(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : "0";
}
