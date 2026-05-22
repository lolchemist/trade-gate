"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Shield, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountSettingsCard } from "@/components/trade-gate/AccountSettingsCard";
import { AnalyticsDashboard } from "@/components/trade-gate/AnalyticsDashboard";
import { CloudSync } from "@/components/trade-gate/CloudSync";
import { EmergencyPanel } from "@/components/trade-gate/EmergencyPanel";
import { HeroStatus } from "@/components/trade-gate/HeroStatus";
import { InstrumentCard } from "@/components/trade-gate/InstrumentCard";
import { LockOverlay } from "@/components/trade-gate/LockOverlay";
import { PermissionCard } from "@/components/trade-gate/PermissionCard";
import { PropRulesCard } from "@/components/trade-gate/PropRulesCard";
import { ReadinessDashboard } from "@/components/trade-gate/ReadinessDashboard";
import { RiskBudgetCard } from "@/components/trade-gate/RiskBudgetCard";
import { SetupPlaybookCard } from "@/components/trade-gate/SetupPlaybookCard";
import { WeeklyReportCard } from "@/components/trade-gate/WeeklyReportCard";
import { MARKET_IDEAS, MAX_INSTRUMENT_IMAGE_BYTES, RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "@/components/trade-gate/constants";
import { ArchiveField, NumberInput, Rule, SectionTitle, Slider, Toggle } from "@/components/trade-gate/form-controls";
import { useLocalStoragePersistence } from "@/hooks/trade-gate/useLocalStoragePersistence";
import { useRiskStatus } from "@/hooks/trade-gate/useRiskStatus";
import { initialPlanningState, planningReducer, type PlanningAction, useTradeGateState } from "@/hooks/trade-gate/useTradeGateState";
import { useSupabaseSync } from "@/hooks/trade-gate/useSupabaseSync";
import { useWeeklyReport } from "@/hooks/trade-gate/useWeeklyReport";
import {
  calculatePermission,
  calculatePlannedRisk,
  formatPlanDate,
  formatSyncStatus,
  getActiveSetups,
  getDailyRiskBudget,
  getDateISO,
  getBestValidScenario,
  getInstrumentImageKey,
  getMarketIdeaKey,
  getNextDateISO,
  getRiskControlsForDate,
  getSetupName,
  isPlanReady,
} from "@/components/trade-gate/utils";
import type {
  ArchivedPlan,
  CarryScenarioMode,
  EditablePlanField,
  MarketIdeaField,
  MarketIdeaNotes,
  PersistedImages,
  RiskControlField,
  RiskControlState,
  SessionPlan,
} from "@/components/trade-gate/types";

type AppTab = "today" | "plan" | "journal" | "analytics" | "settings";

const appTabs: { id: AppTab; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "plan", label: "План" },
  { id: "journal", label: "Журнал" },
  { id: "analytics", label: "Аналитика" },
  { id: "settings", label: "Настройки" },
];

const carryModeOptions: { id: CarryScenarioMode; title: string; detail: string }[] = [
  {
    id: "scenario",
    title: "Только сценарий",
    detail: "Перенести сетап, уровни, триггер и заметки. Расчёт сделки будет очищен.",
  },
  {
    id: "scenario_image",
    title: "Сценарий + график",
    detail: "Дополнительно скопировать изображение инструмента на следующую дату.",
  },
  {
    id: "scenario_trade_plan",
    title: "Сценарий + торговый план",
    detail: "Сохранить расчёт сделки, риск, стоимость пункта и причину входа.",
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TradeGateApp() {
  const storage = useLocalStoragePersistence({ supabaseUrl, supabaseAnonKey });
  const [planning, dispatchPlanning] = useTradeGateState();
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeCarryIds, setCloseCarryIds] = useState<number[]>([]);
  const [closeCarryMode, setCloseCarryMode] = useState<CarryScenarioMode>("scenario_trade_plan");

  const { setups, sessionPlans, archivedPlans, instrumentImages, marketIdeaNotes, dailyRiskBudgets, riskControlsByDate, accountSettings, emergencyNotes, activePlanDate, syncKey } = planning;
  const activeRiskControls = getRiskControlsForDate(riskControlsByDate, activePlanDate);
  const { sleep, anxiety, urge, anger, dailyPnl, dailyLoss, tradesToday, consecutiveStops, plan, newsChecked, stopSet, revenge, lockUntil } = activeRiskControls;
  const activePlanDateLabel = formatPlanDate(activePlanDate);
  const nextPlanDate = getNextDateISO(activePlanDate);
  const nextPlanDateLabel = formatPlanDate(nextPlanDate);
  const activePlansForDate = useMemo(() => sessionPlans.filter((item) => item.planDate === activePlanDate), [sessionPlans, activePlanDate]);
  const activeSetups = useMemo(() => getActiveSetups(setups), [setups]);
  const activeDailyRiskBudget = useMemo(() => getDailyRiskBudget(dailyRiskBudgets, activePlanDate), [dailyRiskBudgets, activePlanDate]);
  const plannedRiskUsed = useMemo(() => calculatePlannedRisk(sessionPlans, activePlanDate), [sessionPlans, activePlanDate]);
  const dailyRiskRemaining = (Number(activeDailyRiskBudget.budgetUsd) || 0) - plannedRiskUsed;
  const emergencyNote = activeRiskControls.emergencyNote ?? emergencyNotes[activePlanDate] ?? "";
  const personalDailyStopLimit = Number(accountSettings.personalDailyStop) || 0;
  const personalDailyStopHit = personalDailyStopLimit > 0 && (Number(dailyPnl) <= -personalDailyStopLimit || Number(dailyLoss) <= -personalDailyStopLimit);
  const propDailyLossUsed = Math.max(Math.abs(Math.min(Number(dailyPnl) || 0, Number(dailyLoss) || 0, 0)), 0);
  const totalLossUsed = Math.max(propDailyLossUsed, Number(accountSettings.personalMaxLoss) > 0 ? propDailyLossUsed : 0);
  const profitProgress = Math.max(0, Number(dailyPnl) || 0);
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;
  const propDailyLossClose = propDailyLossLimit > 0 && propDailyLossUsed >= propDailyLossLimit * 0.8;
  const { isHydrated, syncStatus, setSyncStatus, saveNow, loadFromCloud } = useSupabaseSync({
    storage,
    planning,
    dispatchPlanning,
    initialPlanningState,
  });

  const bestValidScenario = useMemo(() => getBestValidScenario(activePlansForDate), [activePlansForDate]);

  const sessionPlanReadyCount = useMemo(
    () => activePlansForDate.filter(isPlanReady).length,
    [activePlansForDate]
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
    sessionPlansForDate: activePlansForDate,
    personalDailyStopHit,
    dailyRiskRemaining,
    propDailyLossClose,
  });

  const { weeklyReport, analyticsStats } = useWeeklyReport(archivedPlans, activePlanDate, emergencyNotes);
  const isLocked = riskResult.status === "LOCKED";
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
        bestScenarioRisk: Number(bestValidScenario?.plan.tradeRisk) || 0,
        bestScenarioLot: bestValidScenario?.validation.math.lot ?? 0,
      }),
    [riskResult, dailyRiskRemaining, personalDailyStopHit, tradesToday, consecutiveStops, bestValidScenario]
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

  const updateRiskControl = <K extends RiskControlField>(field: K, value: RiskControlState[K]) => {
    dispatchPlanning({ type: "set-risk-control", planDate: activePlanDate, field, value });
  };

  const resetRiskControls = () => {
    const confirmed = window.confirm("Сбросить контрольные вводы для выбранной торговой сессии? Торговый план и архив не изменятся.");
    if (!confirmed) return;
    dispatchPlanning({ type: "reset-risk-controls", planDate: activePlanDate });
    setSyncStatus(`Контрольные вводы для ${activePlanDate} сброшены`);
  };

  const resetTradingPlan = () => {
    const confirmed = window.confirm("Сбросить торговый план выбранной даты? Архив и контрольные вводы не изменятся.");
    if (!confirmed) return;
    dispatchPlanning({ type: "reset-trading-plan", activePlanDate });
    setSyncStatus(`Торговый план для ${activePlanDate} сброшен`);
  };

  const archiveScenario = (id: number) => {
    dispatchPlanning({ type: "archive-plan", id });
    const shouldResetControls = window.confirm("Сбросить контрольные вводы после сделки?");
    if (shouldResetControls) {
      dispatchPlanning({ type: "reset-risk-controls", planDate: activePlanDate });
    }
  };

  const carryScenario = (id: number, mode: CarryScenarioMode) => {
    const action: PlanningAction = { type: "carry-plan", id, nextPlanDate, mode };
    dispatchPlanning(action);
    setSyncStatus(`Сценарий перенесён на ${nextPlanDateLabel}`);
  };

  const openCloseTradingDayDialog = () => {
    if (activePlansForDate.length === 0) {
      setSyncStatus("На выбранную дату нет сценариев для закрытия дня");
      return;
    }

    setCloseCarryIds(activePlansForDate.map((planItem) => planItem.id));
    setCloseCarryMode("scenario_trade_plan");
    setCloseDialogOpen(true);
  };

  const closeTradingDay = () => {
    const action: PlanningAction = { type: "close-trading-day", planDate: activePlanDate, nextPlanDate, carryPlanIds: closeCarryIds, carryMode: closeCarryMode };
    const nextPlanning = planningReducer(planning, action);
    dispatchPlanning(action);
    setCloseDialogOpen(false);
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

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080b] p-4 text-neutral-100">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 text-sm text-neutral-400 shadow-xl shadow-black/15 backdrop-blur-xl">
          Trade Gate загружается…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0c] px-3 py-5 text-neutral-100 md:px-6 md:py-7">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(245,158,11,0.055),transparent_30%),linear-gradient(180deg,#0b0c0f_0%,#08090b_48%,#060608_100%)]" />
        <div className="absolute -top-32 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-emerald-100/[0.055] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-sky-100/[0.04] blur-3xl" />
        <div className="absolute left-0 top-1/3 h-96 w-96 rounded-full bg-rose-100/[0.035] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.045] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-emerald-200/15 bg-emerald-200/[0.07] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-emerald-100/85 shadow-sm backdrop-blur">
                Поведенческий риск-терминал
              </div>
              <h1 className="text-3xl font-semibold uppercase tracking-[-0.035em] md:text-5xl">Trade Gate</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">Спокойная операционная система допуска к сделке: риск · поведение · план · дисциплина.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-right shadow-inner shadow-black/15 md:block">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">Режим аккаунта</div>
              <div className="mt-1 font-mono text-lg font-semibold text-neutral-100">Проп-челлендж $100K</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1 shadow-inner shadow-black/20 backdrop-blur">
              {appTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "border border-emerald-400/30 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-emerald-950/30"
                      : "border border-transparent text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Синхронизация: {formatSyncStatus(syncStatus)}
          </div>
        </motion.header>

        {activeTab === "today" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <HeroStatus result={riskResult} permission={permission} activePlanDateLabel={activePlanDateLabel} />
            <LockOverlay result={riskResult} lockUntil={lockUntil} />

            <div className={`grid gap-5 xl:grid-cols-[1.05fr_0.95fr] ${isLocked ? "opacity-80" : ""}`}>
              <div className="space-y-5">
                <PermissionCard permission={permission} />
                <ReadinessDashboard result={riskResult} sleep={sleep} anxiety={anxiety} urge={urge} anger={anger} />
                <RiskBudgetCard
                  budgetUsd={activeDailyRiskBudget.budgetUsd}
                  plannedRiskUsed={plannedRiskUsed}
                  remainingRisk={dailyRiskRemaining}
                  onBudgetChange={(value) => dispatchPlanning({ type: "set-daily-risk-budget", planDate: activePlanDate, budgetUsd: value })}
                />
              </div>

              <div className="space-y-5">
                <PropRulesCard settings={accountSettings} dailyLossUsed={propDailyLossUsed} totalLossUsed={totalLossUsed} profitProgress={profitProgress} compact />
                <EmergencyPanel
                  note={emergencyNote}
                  onNoteChange={(value) => updateRiskControl("emergencyNote", value)}
                  onEmergency={triggerEmergencyLock}
                />

                <details className="group rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <SectionTitle icon={<Timer className="h-4 w-4" />} title="Контрольные вводы" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:hidden">Открыть</span>
                    <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:inline">Скрыть</span>
                  </summary>
                  <div className={`mt-5 grid gap-5 ${isLocked ? "blur-[0.5px]" : ""}`}>
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <SectionTitle icon={<Timer className="h-4 w-4" />} title="Состояние" />
                          <div className="mt-2 text-xs text-neutral-500">Контрольные вводы для сессии: {activePlanDate}</div>
                        </div>
                        <Button onClick={resetRiskControls} variant="outline" className="rounded-xl border border-white/10 bg-black/30 text-xs text-neutral-200 hover:bg-white/10">
                          Сбросить контрольные вводы
                        </Button>
                      </div>
                      <Slider label="Сон, часов" value={sleep} setValue={(value) => updateRiskControl("sleep", value)} min={0} max={10} suffix="ч" />
                      <Slider label="Тревога" value={anxiety} setValue={(value) => updateRiskControl("anxiety", value)} min={0} max={10} />
                      <Slider label="Желание срочно торговать" value={urge} setValue={(value) => updateRiskControl("urge", value)} min={0} max={10} />
                      <Slider label="Злость / раздражение" value={anger} setValue={(value) => updateRiskControl("anger", value)} min={0} max={10} />
                    </div>

                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                      <SectionTitle icon={<Shield className="h-4 w-4" />} title="Риск-контроль" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <NumberInput label="Финрезультат за день, $" value={dailyPnl} setValue={(value) => updateRiskControl("dailyPnl", value)} />
                        <NumberInput label="Дневной убыток, $" value={dailyLoss} setValue={(value) => updateRiskControl("dailyLoss", value)} />
                        <NumberInput label="Сделок сегодня" value={tradesToday} setValue={(value) => updateRiskControl("tradesToday", value)} />
                        <NumberInput label="Стопов подряд" value={consecutiveStops} setValue={(value) => updateRiskControl("consecutiveStops", value)} />
                      </div>
                      <div className="grid gap-2">
                        <Toggle label="Есть чёткий план сделки" value={plan} setValue={(value) => updateRiskControl("plan", value)} />
                        <Toggle label="Новости проверены" value={newsChecked} setValue={(value) => updateRiskControl("newsChecked", value)} />
                        <Toggle label="Стоп заранее определён" value={stopSet} setValue={(value) => updateRiskControl("stopSet", value)} />
                        <Toggle label="Есть желание отбиться" value={revenge} setValue={(value) => dispatchPlanning({ type: "set-emergency-lock", revenge: value, lockUntil })} danger />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          onClick={() => {
                            const until = new Date();
                            until.setHours(until.getHours() + 2);
                            dispatchPlanning({ type: "set-emergency-lock", revenge, lockUntil: until.toISOString() });
                          }}
                          variant="outline"
                          className="rounded-xl border border-rose-200/20 bg-rose-200/[0.07] text-rose-100 hover:bg-rose-200/[0.1]"
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
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "plan" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.04] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
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

                <div className="mt-5 space-y-5">
                  {MARKET_IDEAS.map((idea) => (
                    <InstrumentCard
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
                      onArchivePlan={archiveScenario}
                      onCarryPlan={carryScenario}
                      onRemovePlan={(id) => dispatchPlanning({ type: "remove-plan", id })}
                    />
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-300">
                  Готовых сценариев на выбранную дату: <span className="font-semibold">{sessionPlanReadyCount}</span>. Если нет ни одного готового сценария — приложение добавляет риск и не даёт торговать “с листа”.
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === "journal" && (
          <div className="space-y-5">
            <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Журнал: ${activePlanDateLabel}`} />
                  <Button onClick={openCloseTradingDayDialog} variant="outline" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
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
                    onChange={(event) => updateRiskControl("emergencyNote", event.target.value)}
                    placeholder="Что сегодня было сделано по плану, где была ошибка, что завтра повторить или запретить?"
                    className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
                  />
                </label>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <WeeklyReportCard report={weeklyReport} />
            <AnalyticsDashboard
              report={weeklyReport}
              byInstrument={analyticsStats.byInstrument}
              bySetup={analyticsStats.bySetup}
              mistakeCount={analyticsStats.mistakeCount}
              revengeNoteCount={analyticsStats.revengeNoteCount}
            />
          </motion.div>
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
              totalLossUsed={totalLossUsed}
              profitProgress={profitProgress}
              onChange={(field, value) => dispatchPlanning({ type: "set-account-setting", field, value })}
            />

            <SetupPlaybookCard
              setups={setups}
              onAdd={(name, description, defaultInstrument) => dispatchPlanning({ type: "add-setup", name, description, defaultInstrument })}
              onUpdate={(id, changes) => dispatchPlanning({ type: "update-setup", id, changes })}
              onDelete={(id) => dispatchPlanning({ type: "delete-setup", id })}
            />

            <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
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
              <Button onClick={resetTradingPlan} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
                Сбросить торговый план
              </Button>
            </div>
          </div>
        )}
      </div>

      {closeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm md:items-center md:p-6">
          <div className="w-full max-w-3xl rounded-[1.75rem] border border-white/[0.08] bg-[#101215]/95 p-5 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-neutral-500">Закрытие дня</div>
                <div className="mt-1 text-xl font-semibold text-neutral-100">Перенос сценариев на {nextPlanDateLabel}</div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
                  Все сценарии текущей даты будут отправлены в архив. Отмеченные сценарии дополнительно появятся в плане следующего дня.
                </p>
              </div>
              <Button onClick={() => setCloseDialogOpen(false)} variant="outline" className="rounded-xl border border-white/10 bg-black/30 text-neutral-200 hover:bg-white/10">
                Закрыть
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="space-y-2">
                {activePlansForDate.map((item) => {
                  const checked = closeCarryIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                        checked ? "border-emerald-200/20 bg-emerald-200/[0.06]" : "border-white/[0.08] bg-white/[0.025]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setCloseCarryIds((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))
                        }
                        className="mt-1 h-4 w-4 accent-emerald-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-neutral-100">
                          {item.symbol} · {item.setupName || "Сетап не выбран"}
                        </span>
                        <span className="mt-1 block truncate text-xs text-neutral-500">{item.entryZone || item.trigger || "Зона входа не заполнена"}</span>
                        {item.carryCount >= 5 && <span className="mt-2 block text-xs text-amber-100">Сценарий переносился несколько дней и может быть уже неактуален.</span>}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Что переносить</div>
                <div className="space-y-2">
                  {carryModeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCloseCarryMode(option.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        closeCarryMode === option.id ? "border-emerald-200/20 bg-emerald-200/[0.07]" : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-neutral-100">{option.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-neutral-500">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
              <div className="text-sm text-neutral-500">
                К переносу выбрано: <span className="font-semibold text-neutral-200">{closeCarryIds.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setCloseCarryIds([])} variant="outline" className="rounded-xl border border-white/10 bg-black/30 text-neutral-200 hover:bg-white/10">
                  Не переносить
                </Button>
                <Button onClick={closeTradingDay} variant="outline" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20">
                  Архивировать и перейти дальше
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
