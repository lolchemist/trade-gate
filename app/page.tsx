"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
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
import { DEFAULT_SETUPS, LOSS_LIMIT, MARKET_IDEAS, RESULT_STATUS_LABELS, TECHNICAL_STATUS_LABELS } from "@/components/trade-gate/constants";
import { ArchiveField, NumberInput, Rule, SectionTitle, Slider, Toggle } from "@/components/trade-gate/form-controls";
import { createTradeGateStorage } from "@/components/trade-gate/storage";
import {
  calculatePermission,
  calculatePlannedRisk,
  calculateTradeMath,
  calculateWeeklyReport,
  createCustomSetup,
  createSessionPlan,
  formatPlanDate,
  getActiveSetups,
  getDailyRiskBudget,
  getDateISO,
  getInitialPlanDate,
  getInstrumentImageKey,
  getMarketIdeaKey,
  getNextDateISO,
  getPreferredSetup,
  getSetupName,
  isPlanReady,
} from "@/components/trade-gate/utils";
import type {
  AccountSettings,
  ArchivedPlan,
  EditablePlanField,
  GateResult,
  MarketIdeaField,
  MarketIdeaNotes,
  PersistedImages,
  PlanningState,
  ReadinessScores,
  SessionPlan,
  Setup,
  TradeCalculatorField,
  TradeCalculatorState,
} from "@/components/trade-gate/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const initialPlanDate = getInitialPlanDate();

const initialPlanningState: PlanningState = {
  setups: DEFAULT_SETUPS,
  sessionPlans: [createSessionPlan(initialPlanDate, "BCOUSD", 1, DEFAULT_SETUPS[0])],
  archivedPlans: [],
  instrumentImages: {},
  marketIdeaNotes: {},
  dailyRiskBudgets: {},
  accountSettings: {
    accountSize: "100000",
    propDailyLossLimit: "5000",
    personalDailyStop: "1000",
    maxLossLimit: "10000",
    personalMaxLoss: "3000",
    profitTarget: "10000",
  },
  emergencyNotes: {},
  activePlanDate: initialPlanDate,
  syncKey: "nataliia-main",
};

const initialCalculatorState: TradeCalculatorState = {
  symbol: "BCOUSD",
  direction: "long",
  entryReason: "",
  entryPrice: 85,
  stopPrice: 84.6,
  takePrice: 86,
  riskDollars: 500,
  dollarsPerPointPerLot: 1000,
};

type PlanningAction =
  | { type: "hydrate"; payload: Partial<PlanningState> }
  | { type: "set-active-date"; activePlanDate: string }
  | { type: "set-sync-key"; syncKey: string }
  | { type: "add-plan"; symbol: string }
  | { type: "update-plan"; id: number; field: EditablePlanField; value: SessionPlan[EditablePlanField] }
  | { type: "remove-plan"; id: number }
  | { type: "archive-plan"; id: number }
  | { type: "restore-plan"; id: number }
  | { type: "set-instrument-image"; key: string; value: string }
  | { type: "set-market-idea-note"; key: string; value: string }
  | { type: "set-daily-risk-budget"; planDate: string; budgetUsd: string }
  | { type: "set-account-setting"; field: keyof AccountSettings; value: string }
  | { type: "set-emergency-note"; planDate: string; value: string }
  | { type: "add-setup"; name: string; description: string; defaultInstrument: string }
  | { type: "update-setup"; id: string; changes: Partial<Pick<Setup, "name" | "description" | "defaultInstrument" | "isActive">> }
  | { type: "delete-setup"; id: string }
  | { type: "close-trading-day"; planDate: string; nextPlanDate: string }
  | { type: "reset-session"; activePlanDate: string };

function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        setups: action.payload.setups ?? state.setups,
        sessionPlans: action.payload.sessionPlans ?? state.sessionPlans,
        archivedPlans: action.payload.archivedPlans ?? state.archivedPlans,
        instrumentImages: action.payload.instrumentImages ?? state.instrumentImages,
        marketIdeaNotes: action.payload.marketIdeaNotes ?? state.marketIdeaNotes,
        dailyRiskBudgets: action.payload.dailyRiskBudgets ?? state.dailyRiskBudgets,
        accountSettings: action.payload.accountSettings ?? state.accountSettings,
        emergencyNotes: action.payload.emergencyNotes ?? state.emergencyNotes,
        activePlanDate: action.payload.activePlanDate ?? state.activePlanDate,
        syncKey: action.payload.syncKey ?? state.syncKey,
      };
    case "set-active-date":
      return { ...state, activePlanDate: action.activePlanDate };
    case "set-sync-key":
      return { ...state, syncKey: action.syncKey };
    case "add-plan":
      return { ...state, sessionPlans: [...state.sessionPlans, createSessionPlan(state.activePlanDate, action.symbol, Date.now(), getPreferredSetup(state.setups))] };
    case "update-plan":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => (plan.id === action.id ? ({ ...plan, [action.field]: action.value } as SessionPlan) : plan)),
      };
    case "remove-plan":
      return { ...state, sessionPlans: state.sessionPlans.filter((plan) => plan.id !== action.id) };
    case "archive-plan": {
      const planToArchive = state.sessionPlans.find((plan) => plan.id === action.id);
      if (!planToArchive) return state;

      return {
        ...state,
        archivedPlans: [
          {
            ...planToArchive,
            setupName: getSetupName(state.setups, planToArchive.setupId, planToArchive.setupName),
            archivedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          },
          ...state.archivedPlans,
        ],
        sessionPlans: state.sessionPlans.filter((plan) => plan.id !== action.id),
      };
    }
    case "restore-plan": {
      const planToRestore = state.archivedPlans.find((plan) => plan.id === action.id);
      if (!planToRestore) return state;

      const restoredPlan: SessionPlan = { ...planToRestore };
      delete (restoredPlan as SessionPlan & Partial<ArchivedPlan>).archivedAt;
      return {
        ...state,
        sessionPlans: [restoredPlan, ...state.sessionPlans],
        archivedPlans: state.archivedPlans.filter((plan) => plan.id !== action.id),
      };
    }
    case "set-instrument-image":
      return { ...state, instrumentImages: { ...state.instrumentImages, [action.key]: action.value } };
    case "set-market-idea-note":
      return { ...state, marketIdeaNotes: { ...state.marketIdeaNotes, [action.key]: action.value } };
    case "set-daily-risk-budget":
      return {
        ...state,
        dailyRiskBudgets: {
          ...state.dailyRiskBudgets,
          [action.planDate]: { planDate: action.planDate, budgetUsd: action.budgetUsd },
        },
      };
    case "set-account-setting":
      return { ...state, accountSettings: { ...state.accountSettings, [action.field]: action.value } };
    case "set-emergency-note":
      return { ...state, emergencyNotes: { ...state.emergencyNotes, [action.planDate]: action.value } };
    case "add-setup": {
      const setup = createCustomSetup({ name: action.name, description: action.description, defaultInstrument: action.defaultInstrument });
      return { ...state, setups: [...state.setups, setup] };
    }
    case "update-setup": {
      const now = new Date().toISOString();
      return {
        ...state,
        setups: state.setups.map((setup) => (setup.id === action.id ? { ...setup, ...action.changes, updatedAt: now } : setup)),
      };
    }
    case "delete-setup":
      return { ...state, setups: state.setups.filter((setup) => setup.id !== action.id || setup.isDefault) };
    case "close-trading-day": {
      const plansToArchive = state.sessionPlans.filter((plan) => plan.planDate === action.planDate);
      const remainingSessionPlans = state.sessionPlans.filter((plan) => plan.planDate !== action.planDate);
      const nextDayAlreadyPrepared = remainingSessionPlans.some((plan) => plan.planDate === action.nextPlanDate);

      return {
        ...state,
        activePlanDate: action.nextPlanDate,
        archivedPlans: [
          ...plansToArchive.map((plan) => ({
            ...plan,
            setupName: getSetupName(state.setups, plan.setupId, plan.setupName),
            archivedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          })),
          ...state.archivedPlans,
        ],
        sessionPlans: nextDayAlreadyPrepared ? remainingSessionPlans : [createSessionPlan(action.nextPlanDate, "BCOUSD", Date.now(), getPreferredSetup(state.setups)), ...remainingSessionPlans],
      };
    }
    case "reset-session":
      return {
        ...state,
        sessionPlans: [createSessionPlan(action.activePlanDate, "BCOUSD", 1, getPreferredSetup(state.setups))],
        archivedPlans: [],
      };
    default:
      return state;
  }
}

export default function TradeGateApp() {
  const storage = useMemo(() => createTradeGateStorage({ supabaseUrl, supabaseAnonKey }), []);
  const [planning, dispatchPlanning] = useReducer(planningReducer, initialPlanningState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [sleep, setSleep] = useState(7);
  const [anxiety, setAnxiety] = useState(5);
  const [urge, setUrge] = useState(5);
  const [anger, setAnger] = useState(2);
  const [dailyPnl, setDailyPnl] = useState<string | number>(0);
  const [tradesToday, setTradesToday] = useState<string | number>(0);
  const [plan, setPlan] = useState(false);
  const [newsChecked, setNewsChecked] = useState(false);
  const [stopSet, setStopSet] = useState(false);
  const [revenge, setRevenge] = useState(false);
  const [dailyLoss, setDailyLoss] = useState<string | number>("0");
  const [consecutiveStops, setConsecutiveStops] = useState<string | number>("0");
  const [lockUntil, setLockUntil] = useState("");
  const [calculator, setCalculator] = useState<TradeCalculatorState>(initialCalculatorState);

  const { setups, sessionPlans, archivedPlans, instrumentImages, marketIdeaNotes, dailyRiskBudgets, accountSettings, emergencyNotes, activePlanDate, syncKey } = planning;
  const activePlanDateLabel = formatPlanDate(activePlanDate);
  const activeSetups = getActiveSetups(setups);
  const activeDailyRiskBudget = getDailyRiskBudget(dailyRiskBudgets, activePlanDate);
  const plannedRiskUsed = calculatePlannedRisk(sessionPlans, activePlanDate);
  const dailyRiskRemaining = (Number(activeDailyRiskBudget.budgetUsd) || 0) - plannedRiskUsed;
  const emergencyNote = emergencyNotes[activePlanDate] ?? "";
  const personalDailyStopHit = Number(dailyPnl) <= -(Number(accountSettings.personalDailyStop) || 0) || Number(dailyLoss) <= -(Number(accountSettings.personalDailyStop) || 0);
  const propDailyLossUsed = Math.max(Math.abs(Math.min(Number(dailyPnl) || 0, Number(dailyLoss) || 0, 0)), 0);
  const propDailyLossLimit = Number(accountSettings.propDailyLossLimit) || 0;
  const propDailyLossClose = propDailyLossLimit > 0 && propDailyLossUsed >= propDailyLossLimit * 0.8;

  useEffect(() => {
    let cancelled = false;

    storage
      .loadInitial(initialPlanningState)
      .then((result) => {
        if (cancelled) return;
        dispatchPlanning({ type: "hydrate", payload: result.state });
        if (result.source !== "default") {
          setSyncStatus(result.message);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to initialize Trade Gate storage", error);
          setSyncStatus("Не удалось загрузить сохранённое состояние");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = window.setTimeout(() => {
      storage.save(planning).then((result) => {
        if (result.source === "localStorage") {
          setSyncStatus(result.message);
        }
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, planning, storage]);

  const tradeMath = useMemo(() => calculateTradeMath(calculator), [calculator]);

  const sessionPlanReadyCount = useMemo(
    () => sessionPlans.filter((item) => item.planDate === activePlanDate && isPlanReady(item)).length,
    [sessionPlans, activePlanDate]
  );

  const riskResult = useMemo<GateResult>(() => {
    let riskScore = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const readiness: ReadinessScores = {
      execution: 100,
      emotional: 100,
      discipline: 100,
    };

    const now = new Date();
    const isLocked = Boolean(lockUntil && new Date(lockUntil) > now);
    const dailyPnlNumber = Number(dailyPnl);
    const dailyLossNumber = Number(dailyLoss);
    const stopsNumber = Number(consecutiveStops);
    const tradesTodayNumber = Number(tradesToday);

    if (isLocked) {
      riskScore += 100;
      readiness.execution = 0;
      readiness.emotional = 0;
      readiness.discipline = 0;
      reasons.push(`торговля заблокирована до ${new Date(lockUntil).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`);
    }

    if (sleep < 6) {
      riskScore += 3;
      readiness.emotional -= 15;
      reasons.push("мало сна: ниже 6 часов");
    }

    if (anxiety >= 7) {
      riskScore += 3;
      readiness.emotional -= 20;
      reasons.push("высокая тревога: 7/10 или выше");
    }

    if (urge >= 7) {
      riskScore += 4;
      readiness.emotional -= 25;
      reasons.push("сильное желание срочно торговать: риск импульсного входа");
    }

    if (anger >= 6) {
      riskScore += 3;
      readiness.emotional -= 20;
      reasons.push("злость / раздражение: риск торговли из желания отбиться");
    }

    if (dailyPnlNumber <= LOSS_LIMIT) {
      riskScore += 50;
      readiness.discipline -= 50;
      reasons.push("дневной лимит убытка достигнут по PnL");
    }

    if (dailyLossNumber <= -1000) {
      riskScore += 50;
      readiness.discipline -= 50;
      reasons.push("дневной убыток ниже -1000$: торговля должна быть остановлена");
    }

    if (personalDailyStopHit) {
      riskScore += 50;
      readiness.discipline -= 50;
      reasons.push("личный дневной стоп достигнут");
    }

    if (dailyRiskRemaining < 0) {
      riskScore += 50;
      readiness.discipline -= 50;
      reasons.push("дневной риск-бюджет превышен");
    }

    if (propDailyLossClose) {
      warnings.push("Лимит дневной просадки проп-фирмы близко. Снизь риск или остановись.");
    }

    if (tradesTodayNumber >= 3) {
      riskScore += 3;
      readiness.discipline -= 15;
      reasons.push("слишком много сделок за день: 3 или больше");
    }

    if (stopsNumber >= 3) {
      riskScore += 30;
      readiness.emotional -= 35;
      readiness.discipline -= 25;
      reasons.push("3 стопа подряд: высокий риск торговли из желания отбиться");
    }

    if (!plan) {
      riskScore += 3;
      readiness.execution -= 20;
      reasons.push("переключатель ‘Есть чёткий план сделки’ выключен");
    }

    if (!newsChecked) {
      riskScore += 2;
      readiness.execution -= 10;
      reasons.push("переключатель ‘Новости проверены’ выключен");
    }

    if (!stopSet) {
      riskScore += 5;
      readiness.discipline -= 25;
      reasons.push("переключатель ‘Стоп заранее определён’ выключен");
    }

    if (revenge) {
      riskScore += 80;
      readiness.emotional = Math.min(readiness.emotional, 10);
      readiness.discipline = Math.min(readiness.discipline, 20);
      reasons.push("включено ‘Есть желание отбиться’ — жёсткая блокировка");
    }

    if (!tradeMath.valid) {
      riskScore += 5;
      readiness.execution -= 20;
      if (!calculator.entryReason || calculator.entryReason.trim().length <= 8) reasons.push("в плане конкретной сделки нет нормальной причины входа");
      if (!tradeMath.stopValid) reasons.push("стоп в плане конкретной сделки стоит с неправильной стороны");
      if (!tradeMath.takeValid) reasons.push("тейк в плане конкретной сделки стоит с неправильной стороны");
      if (tradeMath.stopDistance <= 0) reasons.push("не заполнена дистанция до стопа в плане конкретной сделки");
      if (tradeMath.takeDistance <= 0) reasons.push("не заполнена дистанция до тейка в плане конкретной сделки");
    }

    if (sessionPlanReadyCount === 0) {
      riskScore += 3;
      readiness.execution -= 25;
      reasons.push(`нет готового сценария на дату ${activePlanDateLabel}`);
    }

    if (tradeMath.rr > 0 && tradeMath.rr < 1.5) {
      riskScore += 2;
      readiness.execution -= 10;
      warnings.push("R:R ниже 1:1.5 — сделка может быть невыгодной по математике");
    }

    const revengeDetectorScore = Math.min(
      100,
      (revenge ? 45 : 0) +
        (urge >= 7 ? 20 : 0) +
        (anger >= 6 ? 15 : 0) +
        (stopsNumber >= 2 ? 15 : 0) +
        (dailyPnlNumber < 0 ? 10 : 0) +
        (tradesTodayNumber >= 3 ? 15 : 0)
    );

    if (revengeDetectorScore >= 60) {
      reasons.push("Детектор желания отбиться: состояние похоже на попытку вернуть убыток, а не на спокойное исполнение плана");
      readiness.emotional = Math.min(readiness.emotional, 25);
    } else if (revengeDetectorScore >= 35) {
      warnings.push("Детектор желания отбиться: есть признаки эмоционального давления, снизь риск");
      readiness.emotional = Math.min(readiness.emotional, 60);
    }

    readiness.execution = Math.max(0, Math.min(100, Math.round(readiness.execution)));
    readiness.emotional = Math.max(0, Math.min(100, Math.round(readiness.emotional)));
    readiness.discipline = Math.max(0, Math.min(100, Math.round(readiness.discipline)));

    const hardLock = isLocked || dailyPnlNumber <= LOSS_LIMIT || dailyLossNumber <= -1000 || personalDailyStopHit || dailyRiskRemaining < 0 || revenge || !stopSet || !tradeMath.valid || stopsNumber >= 3;

    if (hardLock) {
      return {
        status: "LOCKED",
        title: "Торговать нельзя",
        subtitle: "Есть жёсткий блокирующий фактор. Только наблюдение или разбор.",
        risk: riskScore,
        reasons,
        warnings,
        readiness,
        revengeDetectorScore,
      };
    }

    if (riskScore >= 8) {
      return {
        status: "DANGER",
        title: "Лучше не торговать",
        subtitle: "Состояние нестабильное. Высокий риск сорваться в импульс.",
        risk: riskScore,
        reasons,
        warnings,
        readiness,
        revengeDetectorScore,
      };
    }

    if (riskScore >= 4) {
      return {
        status: "CAUTION",
        title: "Можно только минимальный риск",
        subtitle: "Одна сделка, риск 0.25%, без добора и без повторного входа.",
        risk: riskScore,
        reasons,
        warnings,
        readiness,
        revengeDetectorScore,
      };
    }

    return {
      status: "OK",
      title: "Торговать можно",
      subtitle: "Только по плану, с заранее заданным стопом и лимитом дня.",
      risk: riskScore,
      reasons,
      warnings,
      readiness,
      revengeDetectorScore,
    };
  }, [
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
    calculator.entryReason,
    sessionPlanReadyCount,
    activePlanDateLabel,
    personalDailyStopHit,
    dailyRiskRemaining,
    propDailyLossClose,
  ]);

  const weeklyReport = useMemo(() => calculateWeeklyReport(archivedPlans, activePlanDate), [archivedPlans, activePlanDate]);
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

  const saveToCloud = async () => {
    setSyncStatus(storage.isCloudConfigured ? "Сохраняю в Supabase…" : "Supabase не настроен, сохраняю локально…");
    const result = await storage.save(planning);
    setSyncStatus(result.message);
  };

  const loadFromCloud = async () => {
    setSyncStatus(storage.isCloudConfigured ? "Загружаю из Supabase…" : "Supabase не настроен, загружаю локальную копию…");
    const result = await storage.load(syncKey, initialPlanningState);
    dispatchPlanning({ type: "hydrate", payload: result.state });
    setSyncStatus(result.message);
  };

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
    storage.save(nextPlanning).then((result) => setSyncStatus(`Торговый день закрыт. ${result.message}`));
  };

  const triggerEmergencyLock = () => {
    const until = new Date();
    until.setHours(until.getHours() + 2);
    setRevenge(true);
    setLockUntil(until.toISOString());
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
    setRevenge(false);
    setDailyLoss("0");
    setConsecutiveStops("0");
    setLockUntil("");
    setCalculator(initialCalculatorState);
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

          <CloudSync
            syncKey={syncKey}
            syncStatus={syncStatus}
            onSyncKeyChange={(value) => dispatchPlanning({ type: "set-sync-key", syncKey: value })}
            onLoad={loadFromCloud}
            onSave={saveToCloud}
          />
        </motion.div>

        <RiskStatus result={riskResult} />

        <PermissionCard permission={permission} />

        <EmergencyCard
          note={emergencyNote}
          onNoteChange={(value) => dispatchPlanning({ type: "set-emergency-note", planDate: activePlanDate, value })}
          onEmergency={triggerEmergencyLock}
        />

        <DailyRiskBudgetCard
          budgetUsd={activeDailyRiskBudget.budgetUsd}
          plannedRiskUsed={plannedRiskUsed}
          remainingRisk={dailyRiskRemaining}
          onBudgetChange={(value) => dispatchPlanning({ type: "set-daily-risk-budget", planDate: activePlanDate, budgetUsd: value })}
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
              <Toggle label="Есть желание отбиться" value={revenge} setValue={setRevenge} danger />
              <div className="grid gap-2 md:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => {
                    const until = new Date();
                    until.setHours(until.getHours() + 2);
                    setLockUntil(until.toISOString());
                  }}
                  variant="outline"
                  className="rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                >
                  Блокировка 2 часа
                </Button>
                <Button
                  type="button"
                  onClick={() => setLockUntil("")}
                  variant="outline"
                  className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                >
                  Снять блокировку
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

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
                <Button onClick={closeTradingDay} variant="outline" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                  Закрыть торговый день
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

            <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
              Готовых сценариев на выбранную дату: <span className="font-semibold">{sessionPlanReadyCount}</span>. Если нет ни одного готового сценария — приложение добавляет риск и не даёт торговать “с листа”.
            </div>
          </CardContent>
        </Card>

        <WeeklyReportCard report={weeklyReport} />

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-4 p-5">
            <SectionTitle icon={<ListChecks className="h-4 w-4" />} title="Архив торговых планов" />
            {archivedPlans.length === 0 ? (
              <div className="rounded-xl bg-neutral-100 px-3 py-3 text-sm text-neutral-600">
                Архив пока пуст. После сессии заполни итог и нажми “В архив”.
              </div>
            ) : (
              <div className="space-y-3">
                {archivedPlans.map((item: ArchivedPlan) => (
                  <div key={item.id} className="rounded-2xl border bg-white p-4">
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

                    {item.archiveComment && <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-700">{item.archiveComment}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <TradeCalculator calculator={calculator} tradeMath={tradeMath} onChange={updateCalculator} />

        <Card className="rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
          <CardContent className="p-5">
            <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Правило для 100k аккаунта" />
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <Rule title="Дневной стоп" value="$1000" />
              <Rule title="Риск на сделку" value="0.25–0.5%" />
              <Rule title="Максимум сделок" value="1–2 идеи" />
            </div>
            <p className="mt-4 text-sm text-neutral-600">Если статус красный — не спорить с приложением. Это не рекомендация, а запрет на торговлю.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={reset} variant="outline" className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10">
            Сбросить проверку
          </Button>
        </div>
      </div>
    </div>
  );
}
