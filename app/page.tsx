"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Shield, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountSettingsCard } from "@/components/trade-gate/AccountSettingsCard";
import { CloudSync } from "@/components/trade-gate/CloudSync";
import { DailyRiskBudgetCard } from "@/components/trade-gate/DailyRiskBudgetCard";
import { EmergencyCard } from "@/components/trade-gate/EmergencyCard";
import { InstrumentPlan } from "@/components/trade-gate/InstrumentPlan";
import { PermissionCard } from "@/components/trade-gate/PermissionCard";
import { RiskStatus } from "@/components/trade-gate/RiskStatus";
import { SetupPlaybookCard } from "@/components/trade-gate/SetupPlaybookCard";
import { TradeCalculator } from "@/components/trade-gate/TradeCalculator";
import { WeeklyReportCard } from "@/components/trade-gate/WeeklyReportCard";
import { MARKET_IDEAS, MAX_INSTRUMENT_IMAGE_BYTES, RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "@/components/trade-gate/constants";
import { ArchiveField, NumberInput, Rule, SectionTitle, Slider, Toggle } from "@/components/trade-gate/form-controls";
import { useLocalStoragePersistence } from "@/hooks/trade-gate/useLocalStoragePersistence";
import { useRiskStatus } from "@/hooks/trade-gate/useRiskStatus";
import { initialCalculatorState, initialPlanningState, planningReducer, type PlanningAction, useTradeGateState } from "@/hooks/trade-gate/useTradeGateState";
import { useSupabaseSync } from "@/hooks/trade-gate/useSupabaseSync";
import { useWeeklyReport } from "@/hooks/trade-gate/useWeeklyReport";
import {
  calculatePermission,
  calculatePlannedRisk,
  calculateTradeMath,
  formatCurrency,
  formatPlanDate,
  formatSyncStatus,
  getActiveSetups,
  getDailyRiskBudget,
  getDateISO,
  getInstrumentImageKey,
  getMarketIdeaKey,
  getNextDateISO,
  getSetupName,
  isPlanReady,
} from "@/components/trade-gate/utils";
import type {
  ArchivedPlan,
  EditablePlanField,
  MarketIdeaField,
  MarketIdeaNotes,
  PersistedImages,
  SessionPlan,
  TradeCalculatorField,
  TradeCalculatorState,
} from "@/components/trade-gate/types";

type AppTab = "today" | "plan" | "journal" | "analytics" | "settings";

const appTabs: { id: AppTab; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "plan", label: "План" },
  { id: "journal", label: "Журнал" },
  { id: "analytics", label: "Аналитика" },
  { id: "settings", label: "Настройки" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TradeGateApp() {
  const storage = useLocalStoragePersistence({ supabaseUrl, supabaseAnonKey });
  const [planning, dispatchPlanning] = useTradeGateState();
  const [sleep, setSleep] = useState(7);
  const [anxiety, setAnxiety] = useState(5);
  const [urge, setUrge] = useState(5);
  const [anger, setAnger] = useState(2);
  const [dailyPnl, setDailyPnl] = useState<string | number>(0);
  const [tradesToday, setTradesToday] = useState<string | number>(0);
  const [plan, setPlan] = useState(false);
  const [newsChecked, setNewsChecked] = useState(false);
  const [stopSet, setStopSet] = useState(false);
  const [dailyLoss, setDailyLoss] = useState<string | number>("0");
  const [consecutiveStops, setConsecutiveStops] = useState<string | number>("0");
  const [calculator, setCalculator] = useState<TradeCalculatorState>(initialCalculatorState);
  const [activeTab, setActiveTab] = useState<AppTab>("today");

  const { setups, sessionPlans, archivedPlans, instrumentImages, marketIdeaNotes, dailyRiskBudgets, accountSettings, emergencyNotes, activePlanDate, syncKey } = planning;
  const revenge = planning.emergencyLock.revenge;
  const lockUntil = planning.emergencyLock.lockUntil;
  const activePlanDateLabel = formatPlanDate(activePlanDate);
  const activeSetups = useMemo(() => getActiveSetups(setups), [setups]);
  const activeDailyRiskBudget = useMemo(() => getDailyRiskBudget(dailyRiskBudgets, activePlanDate), [dailyRiskBudgets, activePlanDate]);
  const plannedRiskUsed = useMemo(() => calculatePlannedRisk(sessionPlans, activePlanDate), [sessionPlans, activePlanDate]);
  const dailyRiskRemaining = (Number(activeDailyRiskBudget.budgetUsd) || 0) - plannedRiskUsed;
  const emergencyNote = emergencyNotes[activePlanDate] ?? "";
  const personalDailyStopLimit = Number(accountSettings.personalDailyStop) || 0;
  const personalDailyStopHit = personalDailyStopLimit > 0 && (Number(dailyPnl) <= -personalDailyStopLimit || Number(dailyLoss) <= -personalDailyStopLimit);
  const propDailyLossUsed = Math.max(Math.abs(Math.min(Number(dailyPnl) || 0, Number(dailyLoss) || 0, 0)), 0);
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;
  const propDailyLossClose = propDailyLossLimit > 0 && propDailyLossUsed >= propDailyLossLimit * 0.8;
  const { isHydrated, syncStatus, setSyncStatus, saveNow, loadFromCloud } = useSupabaseSync({
    storage,
    planning,
    dispatchPlanning,
    initialPlanningState,
  });

  const tradeMath = useMemo(() => calculateTradeMath(calculator), [calculator]);

  const sessionPlanReadyCount = useMemo(
    () => sessionPlans.filter((item) => item.planDate === activePlanDate && isPlanReady(item)).length,
    [sessionPlans, activePlanDate]
  );

  const riskResult = useRiskStatus({
    sleep,
    anxiety,
    urge,
    anger,
    dailyPnl,
    dailyLoss,
    consecutiveStops,
    lockUntil,
    tradesToday,
    plan,
    newsChecked,
    stopSet,
    revenge,
    tradeMath,
    calculator,
    sessionPlanReadyCount,
    activePlanDateLabel,
    personalDailyStopHit,
    dailyRiskRemaining,
    propDailyLossClose,
  });

  const { weeklyReport, analyticsStats } = useWeeklyReport(archivedPlans, activePlanDate, emergencyNotes);
  const permission = useMemo(
    () =>
      calculatePermission({
        status: riskResult.status,
        executionReadiness: riskResult.readiness.execution,
        emotionalReadiness: riskResult.readiness.emotional,
        disciplineReadiness: riskResult.readiness.discipline,
        dailyRiskRemaining,
        revengeDetectorScore: riskResult.revengeDetectorScore,
        personalDailyStopHit,
        tradesToday: Number(tradesToday) || 0,
        consecutiveStops: Number(consecutiveStops) || 0,
      }),
    [riskResult, dailyRiskRemaining, personalDailyStopHit, tradesToday, consecutiveStops]
  );

  const shiftPlanDate = (days: number) => {
    const date = new Date(`${activePlanDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    dispatchPlanning({ type: "set-active-date", activePlanDate: getDateISO(date) });
  };

  const updateSessionPlan = <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => {
    dispatchPlanning({ type: "update-plan", id, field, value });
  };

  const updateMarketIdeaText = (symbol: string, field: MarketIdeaField, value: string) => {
    dispatchPlanning({ type: "set-market-idea-note", key: getMarketIdeaKey(activePlanDate, symbol, field), value });
  };

  const handleInstrumentImage = (symbol: string, file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_INSTRUMENT_IMAGE_BYTES) {
      setSyncStatus(`Изображение слишком большое: максимум ${(MAX_INSTRUMENT_IMAGE_BYTES / 1_000_000).toFixed(2)} МБ. Сожмите файл перед загрузкой.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        dispatchPlanning({ type: "set-instrument-image", key: getInstrumentImageKey(activePlanDate, symbol), value: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const updateCalculator = <K extends TradeCalculatorField>(field: K, value: TradeCalculatorState[K]) => {
    setCalculator((current) => ({ ...current, [field]: value }));
  };

  const closeTradingDay = () => {
    const plansForDate = sessionPlans.filter((item) => item.planDate === activePlanDate);
    if (plansForDate.length === 0) {
      setSyncStatus("На выбранную дату нет сценариев для закрытия дня");
      return;
    }

    const confirmed = window.confirm("Закрыть торговый день? Все сценарии выбранной даты будут перенесены в архив, а план переключится на следующий день.");
    if (!confirmed) return;

    const action: PlanningAction = { type: "close-trading-day", planDate: activePlanDate, nextPlanDate: getNextDateISO(activePlanDate) };
    const nextPlanning = planningReducer(planning, action);
    dispatchPlanning(action);
    storage
      .save(nextPlanning)
      .then((result) => {
        dispatchPlanning({ type: "hydrate", payload: { lastUpdatedAt: result.state.lastUpdatedAt } });
        setSyncStatus(`Торговый день закрыт. ${result.message}`);
      })
      .catch((error) => {
        console.error("Failed to save closed trading day", error);
        setSyncStatus("Торговый день закрыт локально. Ошибка синхронизации.");
      });
  };

  const triggerEmergencyLock = () => {
    const until = new Date();
    until.setHours(until.getHours() + 2);
    dispatchPlanning({ type: "set-emergency-lock", revenge: true, lockUntil: until.toISOString() });
    setSyncStatus("Экстренная блокировка включена на 2 часа");
  };

  const reset = () => {
    setSleep(7);
    setAnxiety(5);
    setUrge(5);
    setAnger(2);
    setDailyPnl(0);
    setTradesToday(0);
    setPlan(false);
    setNewsChecked(false);
    setStopSet(false);
    setDailyLoss("0");
    setConsecutiveStops("0");
    setCalculator(initialCalculatorState);
    dispatchPlanning({ type: "set-emergency-lock", revenge: false, lockUntil: "" });
    dispatchPlanning({ type: "reset-session", activePlanDate });
  };

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080b] p-4 text-neutral-100">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-neutral-400 shadow-2xl backdrop-blur-xl">
          Trade Gate загружается…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080b] p-4 text-neutral-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-300/80 shadow-2xl backdrop-blur">
                Система риск-контроля
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Trade Gate</h1>
              <p className="mt-2 text-sm text-neutral-400">Личный терминал допуска к сделке: состояние · риск · план · дисциплина.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right shadow-2xl backdrop-blur md:block">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Режим аккаунта</div>
              <div className="mt-1 text-lg font-semibold text-neutral-100">Челлендж 100K</div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 rounded-2xl border border-white/10 bg-black/25 p-1 shadow-xl backdrop-blur">
              {appTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-emerald-950/20"
                      : "border border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Синхронизация: {formatSyncStatus(syncStatus)}
          </div>
        </motion.div>

        {activeTab === "today" && (
          <div className="space-y-5">
            <RiskStatus result={riskResult} />

            <PermissionCard permission={permission} />

            <EmergencyCard
              note={emergencyNote}
              onNoteChange={(value) => dispatchPlanning({ type: "set-emergency-note", planDate: activePlanDate, value })}
              onEmergency={triggerEmergencyLock}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
                <CardContent className="space-y-4 p-5">
                  <SectionTitle icon={<Timer className="h-4 w-4" />} title="Состояние" />
                  <Slider label="Сон, часов" value={sleep} setValue={setSleep} min={0} max={10} suffix="ч" />
                  <Slider label="Тревога" value={anxiety} setValue={setAnxiety} min={0} max={10} />
                  <Slider label="Желание срочно торговать" value={urge} setValue={setUrge} min={0} max={10} />
                  <Slider label="Злость / раздражение" value={anger} setValue={setAnger} min={0} max={10} />
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
                <CardContent className="space-y-4 p-5">
                  <SectionTitle icon={<Shield className="h-4 w-4" />} title="Риск-контроль" />
                  <NumberInput label="PnL за день, $" value={dailyPnl} setValue={setDailyPnl} />
                  <NumberInput label="Дневной убыток, $" value={dailyLoss} setValue={setDailyLoss} />
                  <NumberInput label="Сделок сегодня" value={tradesToday} setValue={setTradesToday} />
                  <NumberInput label="Стопов подряд" value={consecutiveStops} setValue={setConsecutiveStops} />
                  <Toggle label="Есть чёткий план сделки" value={plan} setValue={setPlan} />
                  <Toggle label="Новости проверены" value={newsChecked} setValue={setNewsChecked} />
                  <Toggle label="Стоп заранее определён" value={stopSet} setValue={setStopSet} />
                  <Toggle label="Есть желание отбиться" value={revenge} setValue={(value) => dispatchPlanning({ type: "set-emergency-lock", revenge: value, lockUntil })} danger />
                  <div className="grid gap-2 md:grid-cols-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const until = new Date();
                        until.setHours(until.getHours() + 2);
                        dispatchPlanning({ type: "set-emergency-lock", revenge, lockUntil: until.toISOString() });
                      }}
                      variant="outline"
                      className="rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    >
                      Блокировка 2 часа
                    </Button>
                    <Button
                      type="button"
                      onClick={() => dispatchPlanning({ type: "set-emergency-lock", revenge, lockUntil: "" })}
                      variant="outline"
                      className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                    >
                      Снять блокировку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DailyRiskBudgetCard
              budgetUsd={activeDailyRiskBudget.budgetUsd}
              plannedRiskUsed={plannedRiskUsed}
              remainingRisk={dailyRiskRemaining}
              onBudgetChange={(value) => dispatchPlanning({ type: "set-daily-risk-budget", planDate: activePlanDate, budgetUsd: value })}
            />
          </div>
        )}

        {activeTab === "plan" && (
          <div className="space-y-5">
            <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Торговый план на ${activePlanDateLabel}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => shiftPlanDate(-1)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-200">
                      <CalendarDays className="h-4 w-4 text-emerald-300" />
                      <input
                        type="date"
                        value={activePlanDate}
                        onChange={(event) => dispatchPlanning({ type: "set-active-date", activePlanDate: event.target.value })}
                        className="bg-transparent text-neutral-100 outline-none"
                      />
                    </label>
                    <Button onClick={() => shiftPlanDate(1)} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-5">
                  {MARKET_IDEAS.map((idea) => (
                    <InstrumentPlan
                      key={idea.symbol}
                      idea={idea}
                      activePlanDate={activePlanDate}
                      plans={sessionPlans.filter((item) => item.planDate === activePlanDate && item.symbol === idea.symbol)}
                      setups={activeSetups}
                      instrumentImages={instrumentImages as PersistedImages}
                      marketIdeaNotes={marketIdeaNotes as MarketIdeaNotes}
                      onAddScenario={(symbol) => dispatchPlanning({ type: "add-plan", symbol })}
                      onUpdateIdeaText={updateMarketIdeaText}
                      onImageChange={handleInstrumentImage}
                      onUpdatePlan={updateSessionPlan}
                      onArchivePlan={(id) => dispatchPlanning({ type: "archive-plan", id })}
                      onRemovePlan={(id) => dispatchPlanning({ type: "remove-plan", id })}
                    />
                  ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-300">
                  Готовых сценариев на выбранную дату: <span className="font-semibold">{sessionPlanReadyCount}</span>. Если нет ни одного готового сценария — приложение добавляет риск и не даёт торговать “с листа”.
                </div>
              </CardContent>
            </Card>

            <TradeCalculator calculator={calculator} tradeMath={tradeMath} onChange={updateCalculator} />
          </div>
        )}

        {activeTab === "journal" && (
          <div className="space-y-5">
            <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Журнал: ${activePlanDateLabel}`} />
                  <Button onClick={closeTradingDay} variant="outline" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                    Закрыть торговый день
                  </Button>
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <Rule title="Сценариев на дату" value={String(sessionPlans.filter((item) => item.planDate === activePlanDate).length)} />
                  <Rule title="Готовых сценариев" value={String(sessionPlanReadyCount)} />
                  <Rule title="Плановый риск" value={`$${plannedRiskUsed.toFixed(0)}`} />
                  <Rule title="Остаток риска" value={`$${dailyRiskRemaining.toFixed(0)}`} />
                </div>
                <label className="block">
                  <div className="mb-1 text-sm text-neutral-300">Ежедневный разбор</div>
                  <textarea
                    value={emergencyNote}
                    onChange={(event) => dispatchPlanning({ type: "set-emergency-note", planDate: activePlanDate, value: event.target.value })}
                    placeholder="Что сегодня было сделано по плану, где была ошибка, что завтра повторить или запретить?"
                    className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Архив торговых планов" />
                {archivedPlans.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-500">
                    Архив пока пуст. После сессии заполни итог и нажми “В архив”.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {archivedPlans.map((item: ArchivedPlan) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">
                              {item.symbol} · {item.direction.toUpperCase()} · {item.entryZone}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">Архивировано: {item.archivedAt}</div>
                          </div>
                          <Button
                            onClick={() => dispatchPlanning({ type: "restore-plan", id: item.id })}
                            variant="outline"
                            className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                          >
                            Вернуть
                          </Button>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                          <ArchiveField title="Сетап" value={getSetupName(setups, item.setupId, item.setupName)} />
                          <ArchiveField title="Триггер" value={item.trigger} />
                          <ArchiveField title="Стоп" value={item.stop} />
                          <ArchiveField title="Тейк" value={item.take} />
                        </div>

                        <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                          <ArchiveField title="Финрезультат" value={item.finalResult ? `$${item.finalResult}` : "—"} />
                          <ArchiveField title="Итог" value={RESULT_STATUS_LABELS[item.resultStatus] ?? item.resultStatus} />
                          <ArchiveField title="Техничность" value={TECHNICAL_STATUS_LABELS[item.technical] ?? item.technical} />
                          <ArchiveField title="Отмена сценария" value={item.note || "—"} />
                        </div>

                        {item.archiveComment && <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-neutral-300">{item.archiveComment}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-5">
            <WeeklyReportCard report={weeklyReport} />
            <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Разрезы PnL и ошибок" />
                <div className="grid gap-4 md:grid-cols-2">
                  <AnalyticsList title="PnL по инструментам" rows={analyticsStats.byInstrument} />
                  <AnalyticsList title="PnL по сетапам" rows={analyticsStats.bySetup} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <Rule title="Техничность" value={`${weeklyReport.technicalTradePercentage}%`} />
                  <Rule title="Нет входа" value={String(weeklyReport.noEntryCount)} />
                  <Rule title="Стопов" value={String(weeklyReport.stopCount)} />
                  <Rule title="Ошибок / не технично" value={String(analyticsStats.mistakeCount)} />
                </div>
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  Дней с заметкой “что я пытаюсь вернуть”: {analyticsStats.revengeNoteCount}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-5">
            <CloudSync
              syncKey={syncKey}
              syncStatus={syncStatus}
              onSyncKeyChange={(value) => dispatchPlanning({ type: "set-sync-key", syncKey: value })}
              onLoad={() => loadFromCloud(syncKey)}
              onSave={saveNow}
            />

            <AccountSettingsCard
              settings={accountSettings}
              dailyLossUsed={propDailyLossUsed}
              totalLossUsed={Math.max(propDailyLossUsed, Number(accountSettings.personalMaxLoss) > 0 ? propDailyLossUsed : 0)}
              profitProgress={Math.max(0, Number(dailyPnl) || 0)}
              onChange={(field, value) => dispatchPlanning({ type: "set-account-setting", field, value })}
            />

            <SetupPlaybookCard
              setups={setups}
              onAdd={(name, description, defaultInstrument) => dispatchPlanning({ type: "add-setup", name, description, defaultInstrument })}
              onUpdate={(id, changes) => dispatchPlanning({ type: "update-setup", id, changes })}
              onDelete={(id) => dispatchPlanning({ type: "delete-setup", id })}
            />

            <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardContent className="p-5">
                <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Правило для 100k аккаунта" />
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <Rule title="Дневной стоп" value="$1000" />
                  <Rule title="Риск на сделку" value="0.25–0.5%" />
                  <Rule title="Максимум сделок" value="1–2 идеи" />
                </div>
                <p className="mt-4 text-sm text-neutral-500">Если статус красный — не спорить с приложением. Это не рекомендация, а запрет на торговлю.</p>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={reset} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                Сбросить проверку
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-neutral-500">Нет архивных сделок за выбранную неделю.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
              <span className="text-neutral-200">{row.label}</span>
              <span className={`font-mono ${row.value >= 0 ? "text-emerald-200" : "text-red-200"}`}>{formatCurrency(row.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
