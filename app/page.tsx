"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Shield, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudSync } from "@/components/trade-gate/CloudSync";
import { InstrumentPlan } from "@/components/trade-gate/InstrumentPlan";
import { RiskStatus } from "@/components/trade-gate/RiskStatus";
import { TradeCalculator } from "@/components/trade-gate/TradeCalculator";
import { LOSS_LIMIT, MARKET_IDEAS, RESULT_STATUS_LABELS, STORAGE_KEY, TECHNICAL_STATUS_LABELS } from "@/components/trade-gate/constants";
import { ArchiveField, NumberInput, Rule, SectionTitle, Slider, Toggle } from "@/components/trade-gate/form-controls";
import {
  calculateTradeMath,
  createSessionPlan,
  formatPlanDate,
  getDateISO,
  getInitialPlanDate,
  getInstrumentImageKey,
  getMarketIdeaKey,
  isPlanReady,
} from "@/components/trade-gate/utils";
import type {
  ArchivedPlan,
  CloudPayload,
  EditablePlanField,
  GateResult,
  MarketIdeaField,
  MarketIdeaNotes,
  PersistedImages,
  PlanningState,
  ReadinessScores,
  SessionPlan,
  TradeCalculatorField,
  TradeCalculatorState,
} from "@/components/trade-gate/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const initialPlanDate = getInitialPlanDate();

const initialPlanningState: PlanningState = {
  sessionPlans: [createSessionPlan(initialPlanDate, "BCOUSD", 1)],
  archivedPlans: [],
  instrumentImages: {},
  marketIdeaNotes: {},
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
  | { type: "reset-session"; activePlanDate: string };

function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        sessionPlans: action.payload.sessionPlans ?? state.sessionPlans,
        archivedPlans: action.payload.archivedPlans ?? state.archivedPlans,
        instrumentImages: action.payload.instrumentImages ?? state.instrumentImages,
        marketIdeaNotes: action.payload.marketIdeaNotes ?? state.marketIdeaNotes,
        activePlanDate: action.payload.activePlanDate ?? state.activePlanDate,
        syncKey: action.payload.syncKey ?? state.syncKey,
      };
    case "set-active-date":
      return { ...state, activePlanDate: action.activePlanDate };
    case "set-sync-key":
      return { ...state, syncKey: action.syncKey };
    case "add-plan":
      return { ...state, sessionPlans: [...state.sessionPlans, createSessionPlan(state.activePlanDate, action.symbol)] };
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
    case "reset-session":
      return {
        ...state,
        sessionPlans: [createSessionPlan(action.activePlanDate, "BCOUSD", 1)],
        archivedPlans: [],
      };
    default:
      return state;
  }
}

export default function TradeGateApp() {
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

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

  const { sessionPlans, archivedPlans, instrumentImages, marketIdeaNotes, activePlanDate, syncKey } = planning;
  const activePlanDateLabel = formatPlanDate(activePlanDate);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        dispatchPlanning({ type: "hydrate", payload: JSON.parse(saved) as Partial<PlanningState> });
      }
    } catch (error) {
      console.error("Failed to load saved Trade Gate state", error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(planning));
    } catch (error) {
      console.error("Failed to save Trade Gate state", error);
    }
  }, [isHydrated, planning]);

  const cloudPayload: CloudPayload = useMemo(
    () => ({
      sessionPlans,
      archivedPlans,
      instrumentImages,
      marketIdeaNotes,
      activePlanDate,
    }),
    [sessionPlans, archivedPlans, instrumentImages, marketIdeaNotes, activePlanDate]
  );

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
      reasons.push("злость / раздражение: риск revenge trading");
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

    if (tradesTodayNumber >= 3) {
      riskScore += 3;
      readiness.discipline -= 15;
      reasons.push("слишком много сделок за день: 3 или больше");
    }

    if (stopsNumber >= 3) {
      riskScore += 30;
      readiness.emotional -= 35;
      readiness.discipline -= 25;
      reasons.push("3 стопа подряд: высокий риск revenge trading");
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
      reasons.push("Revenge detector: состояние похоже на попытку отбиться, а не на спокойное исполнение плана");
      readiness.emotional = Math.min(readiness.emotional, 25);
    } else if (revengeDetectorScore >= 35) {
      warnings.push("Revenge detector: есть признаки эмоционального давления, снизь риск");
      readiness.emotional = Math.min(readiness.emotional, 60);
    }

    readiness.execution = Math.max(0, Math.min(100, Math.round(readiness.execution)));
    readiness.emotional = Math.max(0, Math.min(100, Math.round(readiness.emotional)));
    readiness.discipline = Math.max(0, Math.min(100, Math.round(readiness.discipline)));

    const hardLock = isLocked || dailyPnlNumber <= LOSS_LIMIT || dailyLossNumber <= -1000 || revenge || !stopSet || !tradeMath.valid || stopsNumber >= 3;

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
  ]);

  const saveToCloud = async () => {
    if (!supabase) {
      setSyncStatus("Supabase не настроен: добавь env-переменные в Vercel.");
      return;
    }

    setSyncStatus("Сохраняю в базу…");
    const { error } = await supabase
      .from("trade_gate_state")
      .upsert(
        {
          user_key: syncKey,
          data: cloudPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_key" }
      );

    if (error) {
      setSyncStatus(`Ошибка сохранения: ${error.message}`);
      return;
    }

    setSyncStatus("Сохранено в базе");
  };

  const loadFromCloud = async () => {
    if (!supabase) {
      setSyncStatus("Supabase не настроен: добавь env-переменные в Vercel.");
      return;
    }

    setSyncStatus("Загружаю из базы…");
    const { data, error } = await supabase.from("trade_gate_state").select("data").eq("user_key", syncKey).maybeSingle();

    if (error) {
      setSyncStatus(`Ошибка загрузки: ${error.message}`);
      return;
    }

    if (!data?.data) {
      setSyncStatus("В базе пока нет данных по этому ключу");
      return;
    }

    dispatchPlanning({ type: "hydrate", payload: data.data as Partial<PlanningState> });
    setSyncStatus("Загружено из базы");
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
                Prop Risk Control System
              </div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Trade Gate</h1>
              <p className="mt-2 text-sm text-neutral-400">Личный терминал допуска к сделке: состояние · риск · план · дисциплина.</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right shadow-2xl backdrop-blur md:block">
              <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Account Mode</div>
              <div className="mt-1 text-lg font-semibold text-neutral-100">100K Challenge</div>
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
                  Lock 2h
                </Button>
                <Button
                  type="button"
                  onClick={() => setLockUntil("")}
                  variant="outline"
                  className="rounded-xl border border-white/10 bg-black/40 text-neutral-100 hover:bg-white/10"
                >
                  Unlock
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
              </div>
            </div>

            <div className="space-y-5">
              {MARKET_IDEAS.map((idea) => (
                <InstrumentPlan
                  key={idea.symbol}
                  idea={idea}
                  activePlanDate={activePlanDate}
                  plans={sessionPlans.filter((item) => item.planDate === activePlanDate && item.symbol === idea.symbol)}
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
                      <ArchiveField title="Триггер" value={item.trigger} />
                      <ArchiveField title="Стоп" value={item.stop} />
                      <ArchiveField title="Тейк" value={item.take} />
                      <ArchiveField title="Финрезультат" value={item.finalResult ? `$${item.finalResult}` : "—"} />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
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
