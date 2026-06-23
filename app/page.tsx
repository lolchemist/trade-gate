"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Shield, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountSettingsCard } from "@/components/trade-gate/AccountSettingsCard";
import { AnalyticsDashboard } from "@/components/trade-gate/AnalyticsDashboard";
import { ArchiveDayGroup } from "@/components/trade-gate/ArchiveDayGroup";
import { BehavioralRiskPanel } from "@/components/trade-gate/BehavioralRiskPanel";
import { CloudSync } from "@/components/trade-gate/CloudSync";
import { EmergencyPanel } from "@/components/trade-gate/EmergencyPanel";
import { FTMORiskCard } from "@/components/trade-gate/FTMORiskCard";
import { FTMOSessionCard } from "@/components/trade-gate/FTMOSessionCard";
import { FTMOSettingsCard } from "@/components/trade-gate/FTMOSettingsCard";
import { HeroStatus, LoadingHero } from "@/components/trade-gate/HeroStatus";
import { InstrumentCard } from "@/components/trade-gate/InstrumentCard";
import { LockOverlay } from "@/components/trade-gate/LockOverlay";
import { PermissionCard } from "@/components/trade-gate/PermissionCard";
import { PropRulesCard } from "@/components/trade-gate/PropRulesCard";
import { ReadinessDashboard } from "@/components/trade-gate/ReadinessDashboard";
import { RiskBudgetCard } from "@/components/trade-gate/RiskBudgetCard";
import { ScenarioReadinessSummary } from "@/components/trade-gate/ScenarioReadinessSummary";
import { TodayMetricsCard } from "@/components/trade-gate/TodayMetricsCard";
import { TradeArgumentLibraryCard } from "@/components/trade-gate/TradeArgumentLibraryCard";
import { MARKET_IDEAS, MAX_INSTRUMENT_IMAGE_BYTES } from "@/components/trade-gate/constants";
import { NumberInput, Rule, SectionTitle, Slider, Toggle } from "@/components/trade-gate/form-controls";
import { useAnalytics } from "@/hooks/trade-gate/useAnalytics";
import { useBehavioralRiskEngine } from "@/hooks/trade-gate/useBehavioralRiskEngine";
import { useFtmoClock } from "@/hooks/trade-gate/useFtmoClock";
import { useLocalStoragePersistence } from "@/hooks/trade-gate/useLocalStoragePersistence";
import { usePermissionToTrade } from "@/hooks/trade-gate/usePermissionToTrade";
import { useRiskStatus } from "@/hooks/trade-gate/useRiskStatus";
import { useScenarioDiagnostics } from "@/hooks/trade-gate/useScenarioDiagnostics";
import { initialPlanningState, planningReducer, type PlanningAction, useTradeGateState } from "@/hooks/trade-gate/useTradeGateState";
import { useSupabaseSync } from "@/hooks/trade-gate/useSupabaseSync";
import { useTodayMetrics } from "@/hooks/trade-gate/useTodayMetrics";
import { calculateFtmoRiskMetrics, getFtmoDailyState } from "@/lib/ftmoRisk";
import { getNextValidTradingDate } from "@/lib/ftmoTime";
import {
  formatPlanDate,
  formatSyncStatus,
  calculateActiveScenarioRisk,
  calculateScenarioTradeMath,
  getDateISO,
  getActiveScenarioEntry,
  getActiveScenarioStop,
  getBestValidScenario,
  getInstrumentImageKey,
  getMarketIdeaKey,
  getPlanEntryMethod,
  getPlanArgumentLabel,
  getRiskControlsForDate,
  getExecutedScenarioTrades,
  getScenarioTotalResult,
  getScenarioTrades,
  isPlanReady,
  mergeTradingDayStatuses,
} from "@/components/trade-gate/utils";
import type {
  ArchivedPlan,
  CarryScenarioMode,
  EditablePlanField,
  EditableTradeField,
  MarketIdeaField,
  MarketIdeaNotes,
  PersistedImages,
  RiskControlField,
  RiskControlState,
  ScenarioTrade,
  SessionPlan,
  FTMODailyState,
  FTMOSettings,
  LocalSessionSettings,
  TradeExecutionType,
} from "@/components/trade-gate/types";

type AppTab = "today" | "work" | "analytics";

const appTabs: { id: AppTab; label: string; eyebrow: string }[] = [
  { id: "today", label: "Сегодня", eyebrow: "Уровень 1" },
  { id: "work", label: "Работа", eyebrow: "Уровень 2" },
  { id: "analytics", label: "Аналитика", eyebrow: "Уровень 3" },
];

const carryModeOptions: { id: CarryScenarioMode; title: string; detail: string }[] = [
  {
    id: "scenario",
    title: "Только сценарий",
    detail: "Перенести только выбранный сценарий: аргументы, уровни, способ входа и заметки. Расчёт сделки будет очищен.",
  },
  {
    id: "scenario_image",
    title: "Сценарий + график",
    detail: "Дополнительно скопировать изображение инструмента на следующую дату.",
  },
  {
    id: "scenario_trade_plan",
    title: "Сценарий + расчёт сделки",
    detail: "Сохранить плановый вход, стоп, тейк, риск, стоимость пункта и лотность только для этого сценария.",
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

  const {
    tradeArguments,
    sessionPlans,
    archivedPlans,
    instrumentImages,
    marketIdeaNotes,
    dailyRiskBudgets,
    tradingDayStatusByDate,
    tradingDayStatuses,
    tradingDayReopenedAtByDate,
    riskControlsByDate,
    controlSessionDate: storedControlSessionDate,
    ftmoSettings,
    localSessionSettings,
    ftmoDailyStateByFtmoTradingDay,
    accountSettings,
    emergencyNotes,
    activePlanDate,
    syncKey,
  } = planning;
  const { appStatus, isHydrated, isCloudLoaded, isInitialSyncComplete, syncStatus, setSyncStatus, saveNow, loadFromCloud } = useSupabaseSync({
    storage,
    planning,
    dispatchPlanning,
    initialPlanningState,
  });
  const isTradingStateReady = isHydrated && isCloudLoaded && isInitialSyncComplete;
  const ftmoClock = useFtmoClock(ftmoSettings, localSessionSettings, isHydrated);
  const ftmoTradingDay = ftmoClock?.ftmoTradingDay ?? activePlanDate;
  const localTradingSessionDate = ftmoClock?.localTradingSessionDate ?? activePlanDate;
  const controlSessionDate = storedControlSessionDate || localTradingSessionDate || activePlanDate;
  const activeRiskControls = getRiskControlsForDate(riskControlsByDate, controlSessionDate);
  const ftmoDailyState = getFtmoDailyState(ftmoDailyStateByFtmoTradingDay, ftmoTradingDay, ftmoSettings.accountSize);
  const ftmoRisk = calculateFtmoRiskMetrics(ftmoSettings, ftmoDailyState);
  const { sleep, anxiety, urge, anger, dailyPnl, dailyLoss, tradesToday, consecutiveStops, plan, newsChecked, stopSet, revenge, lockUntil } = activeRiskControls;
  const activePlanDateLabel = formatPlanDate(activePlanDate);
  const nextPlanDate = getNextValidTradingDate(activePlanDate, localSessionSettings);
  const nextPlanDateLabel = formatPlanDate(nextPlanDate);

  useEffect(() => {
    if (!isHydrated || !ftmoClock) return;
    if (storedControlSessionDate !== ftmoClock.localTradingSessionDate) {
      dispatchPlanning({ type: "set-control-session-date", controlSessionDate: ftmoClock.localTradingSessionDate });
    }
    if (!ftmoDailyStateByFtmoTradingDay[ftmoClock.ftmoTradingDay]) {
      dispatchPlanning({ type: "set-ftmo-daily-state", ftmoTradingDay: ftmoClock.ftmoTradingDay, field: "ftmoTradingDay", value: ftmoClock.ftmoTradingDay });
    }
  }, [dispatchPlanning, ftmoClock, ftmoDailyStateByFtmoTradingDay, isHydrated, storedControlSessionDate]);
  const activePlansForDate = useMemo(() => sessionPlans.filter((item) => item.planDate === activePlanDate), [sessionPlans, activePlanDate]);
  const activeTradePlansForDate = useMemo(() => activePlansForDate.filter((item) => item.status === "active"), [activePlansForDate]);
  const chartImageByScenarioId = useMemo(
    () =>
      Object.fromEntries(
        activePlansForDate.map((item) => [item.id, Boolean(instrumentImages[getInstrumentImageKey(activePlanDate, item.symbol)])])
      ),
    [activePlanDate, activePlansForDate, instrumentImages]
  );
  const scenarioDiagnostics = useScenarioDiagnostics(activePlansForDate, chartImageByScenarioId);
  const closeDaySummary = useMemo(() => {
    const closedScenarios = activePlansForDate.filter((item) => item.status === "closed");
    const noEntryScenarios = activePlansForDate.filter((item) => item.status === "no_entry" || item.resultStatus === "no_entry");
    const totalPnl = activePlansForDate.reduce((total, item) => total + getScenarioTotalResult(item), 0);
    const executedTrades = activePlansForDate.flatMap(getScenarioTrades).filter((trade) => trade.status !== "planned");

    return {
      scenarioCount: activePlansForDate.length,
      closedCount: closedScenarios.length,
      noEntryCount: noEntryScenarios.length,
      totalPnl,
      executedTradeCount: executedTrades.length,
      unfinishedCount: activePlansForDate.filter((item) => item.status === "planned" || item.status === "active").length,
    };
  }, [activePlansForDate]);
  const closedDayTechnicalPercent = useMemo(() => {
    const plansForDate = [
      ...activePlansForDate,
      ...archivedPlans.filter((item) => item.planDate === activePlanDate),
    ];
    const executedTrades = plansForDate.flatMap(getExecutedScenarioTrades);
    if (executedTrades.length === 0) return 100;
    const technicalTrades = executedTrades.filter((trade) => trade.technical === "yes").length;
    return Math.round((technicalTrades / executedTrades.length) * 100);
  }, [activePlanDate, activePlansForDate, archivedPlans]);
  const todayMetrics = useTodayMetrics(activePlanDate, sessionPlans, archivedPlans, dailyRiskBudgets, accountSettings);
  const activeDailyRiskBudget = todayMetrics.dailyRiskBudget;
  const archivedPlansForDate = useMemo(() => archivedPlans.filter((item) => item.planDate === activePlanDate), [archivedPlans, activePlanDate]);
  const archivedDayGroups = useMemo(() => {
    const groups = new Map<string, ArchivedPlan[]>();

    for (const item of archivedPlans) {
      const group = groups.get(item.planDate) ?? [];
      group.push(item);
      groups.set(item.planDate, group);
    }

    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([planDate, plans]) => ({
        planDate,
        plans: [...plans].sort((a, b) => (Date.parse(b.archivedAt) || 0) - (Date.parse(a.archivedAt) || 0)),
      }));
  }, [archivedPlans]);
  const hasArchivedClosedDay = archivedPlansForDate.length > 0;
  const storedTradingDayStatusByDate = useMemo(
    () => mergeTradingDayStatuses(tradingDayStatuses, tradingDayStatusByDate),
    [tradingDayStatusByDate, tradingDayStatuses]
  );
  const latestArchivedAtForDate = useMemo(
    () =>
      archivedPlansForDate.reduce((latest, item) => {
        const archivedAt = Date.parse(item.archivedAt);
        return Math.max(latest, Number.isFinite(archivedAt) ? archivedAt : 0);
      }, 0),
    [archivedPlansForDate]
  );
  const reopenedAtForDate = Date.parse(tradingDayReopenedAtByDate[activePlanDate] ?? "");
  const reopenedAfterArchive = Number.isFinite(reopenedAtForDate) && reopenedAtForDate > latestArchivedAtForDate;
  const selectedDateIsPast = isHydrated && activePlanDate < getDateISO(new Date());
  const explicitlyReopened = Number.isFinite(reopenedAtForDate);
  const inferredClosedDay =
    storedTradingDayStatusByDate[activePlanDate] !== "locked" &&
    ((hasArchivedClosedDay && !reopenedAfterArchive) || (selectedDateIsPast && !explicitlyReopened));
  const effectiveTradingDayStatusByDate = useMemo(
    () => ({
      ...storedTradingDayStatusByDate,
      ...(inferredClosedDay ? { [activePlanDate]: "closed" as const } : {}),
    }),
    [storedTradingDayStatusByDate, inferredClosedDay, activePlanDate]
  );
  const tradingDayStatus = effectiveTradingDayStatusByDate[activePlanDate] ?? "active";
  const isTradingDayClosed = tradingDayStatus === "closed";
  const plannedRiskUsed = todayMetrics.plannedRiskUsed;
  const dailyRiskRemaining = todayMetrics.remainingRisk;
  const emergencyNote = activeRiskControls.emergencyNote ?? emergencyNotes[controlSessionDate] ?? "";
  const personalDailyStopHit = todayMetrics.personalDailyStopHit;
  const personalMaxRiskPerTrade = Number(accountSettings.personalMaxRiskPerTrade) || 0;
  const propDailyLossUsed = todayMetrics.propDailyLossUsed;
  const totalLossUsed = todayMetrics.totalLossUsed;
  const profitProgress = todayMetrics.profitProgress;
  const propDailyLossClose = todayMetrics.propDailyLossClose;

  const bestValidScenario = useMemo(
    () =>
      getBestValidScenario(activePlansForDate.filter((planItem) => planItem.status === "planned" || planItem.status === "active"), {
        personalMaxRiskPerTrade,
      }),
    [activePlansForDate, personalMaxRiskPerTrade]
  );

  const sessionPlanReadyCount = useMemo(
    () => activePlansForDate.filter((planItem) => (planItem.status === "planned" || planItem.status === "active") && isPlanReady(planItem)).length,
    [activePlansForDate]
  );
  const behavioralRisk = useBehavioralRiskEngine({
    activePlanDate,
    sessionPlans,
    archivedPlans,
    riskControls: activeRiskControls,
    todayMetrics,
    accountSettings,
  });

  const riskResult = useRiskStatus({
    sleep,
    anxiety,
    urge,
    anger,
    dailyPnl: todayMetrics.dailyPnlForRiskStatus,
    dailyLoss: todayMetrics.dailyLossForRiskStatus,
    consecutiveStops: todayMetrics.consecutiveStops,
    lockUntil,
    tradesToday: todayMetrics.tradesToday,
    plan,
    newsChecked,
    stopSet,
    revenge,
    sessionPlansForDate: activePlansForDate,
    personalDailyStopHit,
    personalMaxRiskPerTrade,
    plannedRiskUsed,
    dailyRiskRemaining,
    propDailyLossClose,
    propDailyLossHit: todayMetrics.propDailyLossHit,
    behavioralRisk,
    ftmoRisk,
    isWithinTwoHoursOfFtmoReset: ftmoClock?.isWithinTwoHoursOfReset,
    localSessionStatus: ftmoClock?.localSession.status,
    allowAfterHoursTrading: localSessionSettings.allowAfterHoursTrading,
  });

  const analytics = useAnalytics({
    archivedPlans,
    activePlanDate,
    riskControlsByDate,
    dailyRiskBudgets,
    accountSettings,
    emergencyNotes,
  });
  const isLocked = tradingDayStatus === "locked" || riskResult.status === "LOCKED";
  const permission = usePermissionToTrade({
    isReady: isTradingStateReady,
    isTradingDayClosed,
    isLocked,
    riskResult,
    dailyRiskRemaining,
    personalDailyStopHit,
    tradesToday: todayMetrics.tradesToday,
    consecutiveStops: todayMetrics.consecutiveStops,
    bestValidScenario,
    behavioralRisk,
    ftmoRisk,
    localSessionStatus: ftmoClock?.localSession.status,
    allowAfterHoursTrading: localSessionSettings.allowAfterHoursTrading,
  });

  const shiftPlanDate = (days: number) => {
    const date = new Date(`${activePlanDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    dispatchPlanning({ type: "set-active-date", activePlanDate: getDateISO(date) });
  };

  const updateSessionPlan = <K extends EditablePlanField>(id: number, field: K, value: SessionPlan[K]) => {
    dispatchPlanning({ type: "update-plan", id, field, value });
  };

  const addScenarioTrade = (scenarioId: number, executionType: TradeExecutionType) => {
    if (isTradingDayClosed) {
      const confirmed = window.confirm("Торговый день закрыт. Переоткрыть его, чтобы добавить исполнение?");
      if (!confirmed) return;
      dispatchPlanning({ type: "set-trading-day-status", planDate: activePlanDate, status: "active" });
    }
    dispatchPlanning({ type: "add-trade", scenarioId, executionType });
  };

  const activateScenario = (id: number) => {
    if (isTradingDayClosed) {
      const confirmed = window.confirm("Торговый день закрыт. Переоткрыть его, чтобы активировать сделку?");
      if (!confirmed) return;
      dispatchPlanning({ type: "set-trading-day-status", planDate: activePlanDate, status: "active" });
    }
    dispatchPlanning({ type: "activate-plan", id });
    setSyncStatus("Сделка открыта. Риск теперь участвует в дневном лимите.");
  };

  const deactivateScenario = (id: number) => {
    dispatchPlanning({ type: "deactivate-plan", id });
    setSyncStatus("Активность снята. Сценарий снова считается планом, а не открытым риском.");
  };

  const cancelScenario = (id: number) => {
    const confirmed = window.confirm("Отменить сценарий? Он не будет участвовать в дневном риске.");
    if (!confirmed) return;
    dispatchPlanning({ type: "cancel-plan", id });
    setSyncStatus("Сценарий отменён и не занимает дневной риск.");
  };

  const markScenarioNoEntry = (id: number) => {
    dispatchPlanning({ type: "mark-no-entry", id });
    setSyncStatus("Сценарий отмечен как без входа.");
  };

  const updateScenarioTrade = <K extends EditableTradeField>(scenarioId: number, tradeId: string, field: K, value: ScenarioTrade[K]) => {
    dispatchPlanning({ type: "update-trade", scenarioId, tradeId, field, value });
  };

  const removeScenarioTrade = (scenarioId: number, tradeId: string) => {
    dispatchPlanning({ type: "remove-trade", scenarioId, tradeId });
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

    const imageKey = getInstrumentImageKey(activePlanDate, symbol);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[TradeGate chart upload:start]", { symbol, generatedKey: imageKey, fileName: file.name, fileSize: file.size });
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result ?? reader.result;
      if (typeof result === "string") {
        dispatchPlanning({ type: "set-instrument-image", key: imageKey, value: result });
        if (process.env.NODE_ENV !== "production") {
          console.debug("[TradeGate chart upload:stored]", { symbol, storedKey: imageKey });
        }
      }
    };
    reader.onerror = () => {
      setSyncStatus(`Не удалось прочитать график ${symbol}. Попробуйте другой файл.`);
      if (process.env.NODE_ENV !== "production") {
        console.debug("[TradeGate chart upload:error]", { symbol, generatedKey: imageKey, error: reader.error?.message });
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteInstrumentImage = (symbol: string) => {
    const confirmed = window.confirm("Удалить график для этого инструмента и даты?");
    if (!confirmed) return;

    dispatchPlanning({ type: "remove-instrument-image", key: getInstrumentImageKey(activePlanDate, symbol) });
    setSyncStatus(`График ${symbol} удалён для ${activePlanDate}`);
  };

  const updateRiskControl = <K extends RiskControlField>(field: K, value: RiskControlState[K]) => {
    dispatchPlanning({ type: "set-risk-control", planDate: controlSessionDate, field, value });
  };

  const updateFtmoDailyState = <K extends keyof FTMODailyState>(field: K, value: FTMODailyState[K]) => {
    dispatchPlanning({ type: "set-ftmo-daily-state", ftmoTradingDay, field, value });
  };

  const updateFtmoSetting = <K extends keyof FTMOSettings>(field: K, value: FTMOSettings[K]) => {
    dispatchPlanning({ type: "set-ftmo-setting", field, value });
  };

  const updateLocalSessionSetting = <K extends keyof LocalSessionSettings>(field: K, value: LocalSessionSettings[K]) => {
    dispatchPlanning({ type: "set-local-session-setting", field, value });
  };

  const resetRiskControls = () => {
    const confirmed = window.confirm("Сбросить контрольные вводы для выбранной торговой сессии? Торговый план и архив не изменятся.");
    if (!confirmed) return;
    dispatchPlanning({ type: "reset-risk-controls", planDate: controlSessionDate });
    setSyncStatus(`Контрольные вводы для ${controlSessionDate} сброшены`);
  };

  const resetTradingPlan = () => {
    const confirmed = window.confirm("Сбросить торговый план выбранной даты? Архив и контрольные вводы не изменятся.");
    if (!confirmed) return;
    dispatchPlanning({ type: "reset-trading-plan", activePlanDate });
    setSyncStatus(`Торговый план для ${activePlanDate} сброшен`);
  };

  const closeScenario = (id: number) => {
    dispatchPlanning({ type: "close-plan", id });
    setSyncStatus("Сделка закрыта внутри дня. Архив будет обновлён при закрытии торгового дня.");
  };

  const reopenScenario = (id: number) => {
    dispatchPlanning({ type: "reopen-plan", id });
    setSyncStatus("Сценарий возвращён в план");
  };

  const reopenTradingDay = () => {
    const confirmed = window.confirm("Переоткрыть торговый день? Сценарии снова станут редактируемыми, а Today вернётся в активный режим.");
    if (!confirmed) return;
    dispatchPlanning({ type: "set-trading-day-status", planDate: activePlanDate, status: "active" });
    setSyncStatus(`Торговый день ${activePlanDate} переоткрыт`);
  };

  const carryScenario = (id: number, mode: CarryScenarioMode) => {
    const action: PlanningAction = { type: "carry-scenario", id, nextPlanDate, mode };
    dispatchPlanning(action);
    setSyncStatus(`Сценарий перенесён на ${nextPlanDateLabel}`);
  };

  const openCloseTradingDayDialog = () => {
    setCloseCarryIds(activePlansForDate.filter((planItem) => planItem.status === "planned" || planItem.status === "active").map((planItem) => planItem.id));
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
        dispatchPlanning({ type: "hydrate", payload: result.state });
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
    dispatchPlanning({ type: "set-emergency-lock", revenge: true, lockUntil: until.toISOString(), planDate: controlSessionDate });
    setSyncStatus("Экстренная блокировка включена на 2 часа");
  };

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080b] p-4 text-neutral-100">
        <div className="w-full max-w-4xl">
          <LoadingHero syncStatus={syncStatus} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e10] px-3 py-5 text-neutral-100 md:px-6 md:py-7">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#151619_0%,#101113_46%,#0b0c0e_100%)]" />
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_50%_0%,rgba(167,243,208,0.075),transparent_42%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-white/[0.07] bg-white/[0.04] p-4 shadow-xl shadow-black/15 backdrop-blur-2xl md:p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-neutral-400 shadow-sm backdrop-blur">
                Личное рабочее пространство трейдера
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.035em] md:text-5xl">Trade Gate</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">Допуск к сделке, торговая работа и память решений без визуального шума.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-right shadow-inner shadow-black/15 md:block">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">Режим аккаунта</div>
              <div className="mt-1 font-mono text-lg font-semibold text-neutral-100">Проп-челлендж $100K</div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 rounded-2xl border border-white/[0.08] bg-black/18 p-1 shadow-inner shadow-black/15 backdrop-blur">
              {appTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-2 text-left transition ${
                    activeTab === tab.id
                      ? "border border-emerald-200/20 bg-emerald-200/[0.09] text-emerald-50 shadow-lg shadow-black/15"
                      : "border border-transparent text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-100"
                  }`}
                >
                  <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.18em] opacity-60">{tab.eyebrow}</span>
                  <span className="mt-0.5 block text-sm font-semibold">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Синхронизация: {formatSyncStatus(syncStatus)} · Состояние: {appStatus === "loading" ? "проверка" : appStatus === "syncing" ? "синхронизация" : appStatus === "error" ? "ошибка" : "готово"}
          </div>
        </motion.header>

        {activeTab === "today" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-7">
            {!isTradingStateReady ? (
              <LoadingHero syncStatus={syncStatus} />
            ) : (
              <>
                <HeroStatus
                  result={isLocked ? { ...riskResult, status: "LOCKED" } : riskResult}
                  permission={permission}
                  activePlanDateLabel={activePlanDateLabel}
                  activePlanDate={activePlanDate}
                  tradingDayStatusByDate={effectiveTradingDayStatusByDate}
                  closedDay={{
                    metrics: todayMetrics,
                    disciplineScore: riskResult.readiness.discipline,
                    technicalPercent: closedDayTechnicalPercent,
                    argumentCount: new Set(activePlansForDate.flatMap((item) => item.argumentNames)).size,
                    onReopen: reopenTradingDay,
                  }}
                />
                {!isTradingDayClosed && <LockOverlay result={isLocked ? { ...riskResult, status: "LOCKED" } : riskResult} lockUntil={lockUntil} />}

                <div className={`grid gap-6 xl:grid-cols-[1.08fr_0.92fr] ${isLocked && !isTradingDayClosed ? "opacity-85" : ""}`}>
                  <section className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">Главное сегодня</div>
                        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-neutral-100">Допуск, риск и результат дня</h2>
                      </div>
                      <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-neutral-400">
                        {activePlanDateLabel}
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <PermissionCard permission={permission} />
                      <TodayMetricsCard metrics={todayMetrics} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <RiskBudgetCard
                        budgetUsd={activeDailyRiskBudget.budgetUsd}
                        plannedRiskUsed={plannedRiskUsed}
                        usedRisk={todayMetrics.riskUsedTotal}
                        realizedLossUsed={todayMetrics.realizedLossUsed}
                        activeRiskExposureUsed={todayMetrics.activeRiskExposureUsed}
                        remainingRisk={dailyRiskRemaining}
                        isClosedDay={isTradingDayClosed}
                        onBudgetChange={(value) => dispatchPlanning({ type: "set-daily-risk-budget", planDate: activePlanDate, budgetUsd: value })}
                      />
                      <PropRulesCard settings={accountSettings} dailyLossUsed={propDailyLossUsed} totalLossUsed={totalLossUsed} profitProgress={profitProgress} compact />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">Фокус</div>
                        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-neutral-100">Активные идеи и состояние</h2>
                      </div>
                      <Button onClick={() => setActiveTab("work")} variant="outline" className="rounded-xl border border-white/10 bg-white/[0.04] text-neutral-100 hover:bg-white/[0.08]">
                        Открыть работу
                      </Button>
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <Rule title="Сценариев" value={String(activePlansForDate.length)} />
                      <Rule title="Готовых" value={String(sessionPlanReadyCount)} />
                      <Rule title="Закрытых" value={String(closeDaySummary.closedCount)} />
                    </div>
                    <ActiveTradesPanel plans={activeTradePlansForDate} />
                    {!isTradingDayClosed && <ScenarioReadinessSummary diagnostics={scenarioDiagnostics} />}
                    {!isTradingDayClosed && <BehavioralRiskPanel behavioralRisk={behavioralRisk} />}
                    {!isTradingDayClosed && (
                      <EmergencyPanel
                        note={emergencyNote}
                        onNoteChange={(value) => updateRiskControl("emergencyNote", value)}
                        onEmergency={triggerEmergencyLock}
                      />
                    )}
                  </section>
                </div>

                {!isTradingDayClosed && (
                  <section className="space-y-4">
                    <div>
                      <div className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">Состояние системы</div>
                      <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-neutral-100">Готовность без лишнего давления</h2>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                      <ReadinessDashboard result={riskResult} sleep={sleep} anxiety={anxiety} urge={urge} anger={anger} />
                      <FTMOSessionCard
                        activePlanDate={activePlanDate}
                        ftmoTradingDay={ftmoTradingDay}
                        localTradingSessionDate={localTradingSessionDate}
                        localSession={ftmoClock?.localSession}
                      />
                    </div>
                  </section>
                )}
              </>
            )}
          </motion.div>
        )}

        {activeTab === "work" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <section className="rounded-[2rem] border border-white/[0.07] bg-white/[0.04] p-5 shadow-xl shadow-black/15 backdrop-blur-xl md:p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-neutral-500">Работа трейдера</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-neutral-100">План, сценарии и дневной разбор</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
                    Здесь живут активные идеи, графики, исполнения, переносы и закрытие дня. Главный экран остаётся чистым для допуска.
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 md:min-w-[280px]">
                  <Rule title="Дата плана" value={activePlanDateLabel} />
                  <Rule title="Статус дня" value={isTradingDayClosed ? "Завершён" : "Активен"} />
                </div>
              </div>
            </section>
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.04] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Торговый план на ${activePlanDateLabel}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    {isTradingDayClosed && (
                      <Button onClick={reopenTradingDay} variant="outline" className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100 hover:bg-emerald-200/[0.1]">
                        Переоткрыть торговый день
                      </Button>
                    )}
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
                      key={getInstrumentImageKey(activePlanDate, idea.symbol)}
                      idea={idea}
                      activePlanDate={activePlanDate}
                      plans={sessionPlans.filter((item) => item.planDate === activePlanDate && item.symbol === idea.symbol)}
                      tradeArguments={tradeArguments}
                      instrumentImages={instrumentImages as PersistedImages}
                      marketIdeaNotes={marketIdeaNotes as MarketIdeaNotes}
                      onAddScenario={(symbol) => {
                        if (isTradingDayClosed) {
                          const confirmed = window.confirm("Торговый день закрыт. Переоткрыть его, чтобы добавить сценарий?");
                          if (!confirmed) return;
                          dispatchPlanning({ type: "set-trading-day-status", planDate: activePlanDate, status: "active" });
                        }
                        dispatchPlanning({ type: "add-plan", symbol });
                      }}
                      onUpdateIdeaText={updateMarketIdeaText}
                      onImageChange={handleInstrumentImage}
                      onDeleteImage={deleteInstrumentImage}
                      onUpdatePlan={updateSessionPlan}
                      onActivatePlan={activateScenario}
                      onDeactivatePlan={deactivateScenario}
                      onCancelPlan={cancelScenario}
                      onNoEntryPlan={markScenarioNoEntry}
                      onAddTrade={addScenarioTrade}
                      onUpdateTrade={updateScenarioTrade}
                      onRemoveTrade={removeScenarioTrade}
                      onClosePlan={closeScenario}
                      onReopenPlan={reopenScenario}
                      onCarryPlan={carryScenario}
                      onRemovePlan={(id) => dispatchPlanning({ type: "remove-plan", id })}
                      onSaveNow={saveNow}
                    />
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-300">
                  Готовых сценариев на выбранную дату: <span className="font-semibold">{sessionPlanReadyCount}</span>. Если нет ни одного готового сценария — приложение добавляет риск и не даёт торговать “с листа”.
                </div>
            </div>

            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle icon={<ListChecks className="h-4 w-4" />} title={`Журнал: ${activePlanDateLabel}`} />
                    <Button onClick={openCloseTradingDayDialog} variant="outline" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20">
                      Закрыть торговый день
                    </Button>
                  </div>
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <Rule title="Плановый риск" value={`$${plannedRiskUsed.toFixed(0)}`} />
                    <Rule title="Факт PnL" value={`$${todayMetrics.realizedPnl.toFixed(0)}`} />
                    <Rule title="Закрытых сценариев" value={String(closeDaySummary.closedCount)} />
                    <Rule title="Исполнений" value={String(closeDaySummary.executedTradeCount)} />
                  </div>
                  <label className="block">
                    <div className="mb-1 text-sm text-neutral-300">Ежедневный разбор</div>
                    <textarea
                      value={emergencyNote}
                      onChange={(event) => updateRiskControl("emergencyNote", event.target.value)}
                      placeholder="Что сегодня было сделано по плану, где была ошибка, что завтра повторить или запретить?"
                      className="min-h-24 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-400/30"
                    />
                  </label>
                </CardContent>
              </Card>

              <details className="group rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <SectionTitle icon={<Timer className="h-4 w-4" />} title="Контроль дисциплины" />
                    <p className="mt-2 text-sm text-neutral-500">Ручные вводы, эмоции и экстренная блокировка не занимают главный экран.</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:hidden">Открыть</span>
                  <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:inline">Скрыть</span>
                </summary>
                <div className={`mt-5 grid gap-5 ${isLocked && !isTradingDayClosed ? "blur-[0.5px]" : ""}`}>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <SectionTitle icon={<Timer className="h-4 w-4" />} title="Состояние" />
                        <div className="mt-2 text-xs text-neutral-500">Контрольные вводы для локальной сессии: {controlSessionDate}</div>
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

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <SectionTitle icon={<Shield className="h-4 w-4" />} title="Риск-контроль" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberInput label="Ручная поправка PnL, $" value={dailyPnl} setValue={(value) => updateRiskControl("dailyPnl", value)} />
                      <NumberInput label="Ручная поправка убытка, $" value={dailyLoss} setValue={(value) => updateRiskControl("dailyLoss", value)} />
                      <NumberInput label="Доп. сделок вручную" value={tradesToday} setValue={(value) => updateRiskControl("tradesToday", value)} />
                      <NumberInput label="Доп. стопов подряд" value={consecutiveStops} setValue={(value) => updateRiskControl("consecutiveStops", value)} />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-relaxed text-neutral-500">
                      Фактические PnL, сделки и стопы считаются из закрытых и архивных сценариев выбранной даты. Эти поля остаются ручной поправкой.
                    </div>
                    <div className="grid gap-2">
                      <Toggle label="Есть чёткий план сделки" value={plan} setValue={(value) => updateRiskControl("plan", value)} />
                      <Toggle label="Новости проверены" value={newsChecked} setValue={(value) => updateRiskControl("newsChecked", value)} />
                      <Toggle label="Стоп заранее определён" value={stopSet} setValue={(value) => updateRiskControl("stopSet", value)} />
                      <Toggle label="Есть желание отбиться" value={revenge} setValue={(value) => dispatchPlanning({ type: "set-emergency-lock", revenge: value, lockUntil, planDate: controlSessionDate })} danger />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        onClick={() => {
                          const until = new Date();
                          until.setHours(until.getHours() + 2);
                          dispatchPlanning({ type: "set-emergency-lock", revenge, lockUntil: until.toISOString(), planDate: controlSessionDate });
                        }}
                        variant="outline"
                        className="rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-rose-100 hover:bg-rose-200/[0.1]"
                      >
                        Блокировка 2 часа
                      </Button>
                      <Button
                        type="button"
                        onClick={() => dispatchPlanning({ type: "set-emergency-lock", revenge, lockUntil: "", planDate: controlSessionDate })}
                        variant="outline"
                        className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                      >
                        Снять блокировку
                      </Button>
                    </div>
                  </div>
                </div>
              </details>
            </section>

            <details className="group rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <SectionTitle icon={<Shield className="h-4 w-4" />} title="Настройки и синхронизация" />
                  <p className="mt-2 text-sm text-neutral-500">Редко используемые настройки доступны ниже, но не конкурируют с торговым фокусом.</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:hidden">Открыть</span>
                <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 group-open:inline">Скрыть</span>
              </summary>
              <div className="mt-5 space-y-5">
                <CloudSync
                  syncKey={syncKey}
                  syncStatus={syncStatus}
                  onSyncKeyChange={(value) => dispatchPlanning({ type: "set-sync-key", syncKey: value })}
                  onLoad={() => loadFromCloud(syncKey)}
                  onSave={saveNow}
                />
                <FTMOSessionCard
                  activePlanDate={activePlanDate}
                  ftmoTradingDay={ftmoTradingDay}
                  localTradingSessionDate={localTradingSessionDate}
                  localSession={ftmoClock?.localSession}
                />
                <FTMORiskCard
                  settings={ftmoSettings}
                  dailyState={ftmoDailyState}
                  metrics={ftmoRisk}
                  ftmoTradingDay={ftmoTradingDay}
                  ftmoTimeLabel={ftmoClock?.ftmoTimeLabel}
                  localTimeLabel={ftmoClock?.localTimeLabel}
                  localResetTimeLabel={ftmoClock?.localResetTimeLabel}
                  timeUntilReset={ftmoClock?.timeUntilReset}
                  isWithinTwoHoursOfReset={ftmoClock?.isWithinTwoHoursOfReset}
                  onDailyStateChange={updateFtmoDailyState}
                />
                <AccountSettingsCard
                  settings={accountSettings}
                  dailyLossUsed={propDailyLossUsed}
                  totalLossUsed={totalLossUsed}
                  profitProgress={profitProgress}
                  onChange={(field, value) => dispatchPlanning({ type: "set-account-setting", field, value })}
                />
                <FTMOSettingsCard
                  ftmoSettings={ftmoSettings}
                  localSessionSettings={localSessionSettings}
                  onFtmoChange={updateFtmoSetting}
                  onLocalSessionChange={updateLocalSessionSetting}
                />
                <TradeArgumentLibraryCard
                  tradeArguments={tradeArguments}
                  onAdd={(name) => dispatchPlanning({ type: "add-trade-argument", name })}
                  onUpdate={(id, name) => dispatchPlanning({ type: "update-trade-argument", id, name })}
                  onDelete={(id) => dispatchPlanning({ type: "delete-trade-argument", id })}
                />
                <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Правило для 10k аккаунта" />
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                      <Rule title="Дневной стоп" value="$100" />
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
            </details>
          </motion.div>
        )}

        {activeTab === "analytics" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <section className="rounded-[2rem] border border-white/[0.07] bg-white/[0.04] p-5 shadow-xl shadow-black/15 backdrop-blur-xl md:p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-neutral-500">Память и статистика</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-neutral-100">Что работает, что ломает результат</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
                    Аналитика, история и архив отделены от допуска, чтобы главный экран оставался лёгким.
                  </p>
                </div>
                <div className="grid min-w-[260px] gap-2 text-sm sm:grid-cols-2">
                  <Rule title="Архивных сценариев" value={String(archivedPlans.length)} />
                  <Rule title="Дней в архиве" value={String(archivedDayGroups.length)} />
                </div>
              </div>
            </section>
            <AnalyticsDashboard analytics={analytics} />

            <Card className="rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-xl shadow-black/15 backdrop-blur-xl">
              <CardContent className="space-y-4 p-5">
                <div>
                  <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Архив сценариев" />
                  <div className="mt-2 text-sm text-neutral-500">
                    Визуальная память торговых идей: день, сценарий, график, аргументы и фактические исполнения.
                  </div>
                </div>
                {archivedDayGroups.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-neutral-500">
                    Архив пока пуст. Сценарии попадут сюда после кнопки “Закрыть торговый день”.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {archivedDayGroups.map((group) => (
                      <ArchiveDayGroup
                        key={group.planDate}
                        planDate={group.planDate}
                        plans={group.plans}
                        onRestore={(id) => dispatchPlanning({ type: "restore-plan", id })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
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
                <div className="mb-3 grid gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-3 text-sm md:grid-cols-4">
                  <Rule title="В архив" value={String(closeDaySummary.scenarioCount)} />
                  <Rule title="Закрытых" value={String(closeDaySummary.closedCount)} />
                  <Rule title="PnL дня" value={`$${closeDaySummary.totalPnl.toFixed(0)}`} />
                  <Rule title="Без входа" value={String(closeDaySummary.noEntryCount)} />
                </div>
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
                          {item.symbol} · {getPlanArgumentLabel(item)}
                        </span>
                        <span className="mt-1 block truncate text-xs text-neutral-500">{item.entryZone || getPlanEntryMethod(item) || "Способ входа не выбран"}</span>
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
                К переносу выбрано: <span className="font-semibold text-neutral-200">{closeCarryIds.length}</span> · Фактических исполнений:{" "}
                <span className="font-semibold text-neutral-200">{closeDaySummary.executedTradeCount}</span>
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

function ActiveTradesPanel({ plans }: { plans: SessionPlan[] }) {
  return (
    <div className="rounded-[1.5rem] border border-white/[0.07] bg-white/[0.035] p-4 shadow-inner shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-neutral-500">Активные сделки</div>
          <div className="mt-1 text-sm text-neutral-400">Реальный открытый риск, который занимает дневной лимит.</div>
        </div>
        <div className="rounded-full border border-cyan-200/15 bg-cyan-200/[0.055] px-3 py-1 text-xs font-semibold text-cyan-100">
          {plans.length}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-sm text-neutral-500">
          Сейчас нет активных сделок. Planned-сценарии не уменьшают остаток дневного риска.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {plans.map((plan) => {
            const risk = calculateActiveScenarioRisk(plan);
            const rr = calculateScenarioTradeMath(plan).rr;
            const entry = getActiveScenarioEntry(plan);
            const stop = getActiveScenarioStop(plan);

            return (
              <div key={plan.id} className="rounded-2xl border border-cyan-200/12 bg-cyan-200/[0.045] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-100">
                    {plan.symbol} · {directionShortLabel(plan.direction)}
                  </div>
                  <div className="rounded-full border border-cyan-200/15 bg-black/20 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                    Активная
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-400">
                  <span>Entry {entry || "—"}</span>
                  <span>SL {stop || "—"}</span>
                  <span>Risk ${risk.toFixed(0)}</span>
                  <span>RR {rr > 0 ? `1:${rr.toFixed(2)}` : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function directionShortLabel(direction: SessionPlan["direction"]) {
  if (direction === "short") return "Short";
  if (direction === "both") return "Both";
  return "Long";
}
