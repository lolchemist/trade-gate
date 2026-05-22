import { useReducer } from "react";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_ENTRY_METHODS, DEFAULT_SETUPS } from "@/constants/trade-gate";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import {
  createCustomEntryMethod,
  createCustomSetup,
  createDefaultRiskControls,
  createScenarioTrade,
  createSessionPlan,
  ensureScenarioCloseTrade,
  getInitialPlanDate,
  getInstrumentImageKey,
  getPlanEntryMethod,
  getPlanSetupNames,
  getPreferredSetup,
  getRiskControlsForDate,
  getSetupNames,
  syncLegacyResultFields,
  validateScenarioPlan,
} from "@/components/trade-gate/utils";
import type {
  AccountSettings,
  ArchivedPlan,
  CarryScenarioMode,
  EditablePlanField,
  EditableTradeField,
  EntryMethod,
  PlanningState,
  RiskControlField,
  RiskControlState,
  ScenarioTrade,
  SessionPlan,
  Setup,
  TradeExecutionType,
  TradingDayStatus,
} from "@/types/trade-gate";

const initialPlanDate = getInitialPlanDate();

export const initialPlanningState: PlanningState = {
  setups: DEFAULT_SETUPS,
  entryMethods: DEFAULT_ENTRY_METHODS,
  sessionPlans: [createSessionPlan(initialPlanDate, DEFAULT_INSTRUMENT_SYMBOL, 1, DEFAULT_SETUPS[0])],
  archivedPlans: [],
  instrumentImages: {},
  marketIdeaNotes: {},
  dailyRiskBudgets: {},
  tradingDayStatusByDate: {},
  tradingDayStatuses: {},
  riskControlsByDate: {
    [initialPlanDate]: createDefaultRiskControls(),
  },
  accountSettings: DEFAULT_ACCOUNT_SETTINGS,
  emergencyNotes: {},
  emergencyLock: {
    revenge: false,
    lockUntil: "",
  },
  activePlanDate: initialPlanDate,
  syncKey: "nataliia-main",
  lastUpdatedAt: "",
};

export type PlanningAction =
  | { type: "hydrate"; payload: Partial<PlanningState> }
  | { type: "set-active-date"; activePlanDate: string }
  | { type: "set-sync-key"; syncKey: string }
  | { type: "add-plan"; symbol: string }
  | { type: "update-plan"; id: number; field: EditablePlanField; value: SessionPlan[EditablePlanField] }
  | { type: "add-trade"; scenarioId: number; executionType: TradeExecutionType }
  | { type: "update-trade"; scenarioId: number; tradeId: string; field: EditableTradeField; value: ScenarioTrade[EditableTradeField] }
  | { type: "remove-trade"; scenarioId: number; tradeId: string }
  | { type: "remove-plan"; id: number }
  | { type: "close-plan"; id: number }
  | { type: "reopen-plan"; id: number }
  | { type: "restore-plan"; id: number }
  | { type: "carry-plan"; id: number; nextPlanDate: string; mode: CarryScenarioMode }
  | { type: "set-instrument-image"; key: string; value: string }
  | { type: "remove-instrument-image"; key: string }
  | { type: "set-market-idea-note"; key: string; value: string }
  | { type: "set-daily-risk-budget"; planDate: string; budgetUsd: string }
  | { type: "set-trading-day-status"; planDate: string; status: TradingDayStatus }
  | { type: "set-risk-control"; planDate: string; field: RiskControlField; value: RiskControlState[RiskControlField] }
  | { type: "reset-risk-controls"; planDate: string }
  | { type: "set-account-setting"; field: keyof AccountSettings; value: string }
  | { type: "set-emergency-note"; planDate: string; value: string }
  | { type: "set-emergency-lock"; revenge: boolean; lockUntil: string }
  | { type: "add-setup"; name: string; description: string; defaultInstrument: string }
  | { type: "update-setup"; id: string; changes: Partial<Pick<Setup, "name" | "description" | "defaultInstrument" | "isActive">> }
  | { type: "delete-setup"; id: string }
  | { type: "add-entry-method"; name: string; description: string }
  | { type: "update-entry-method"; id: string; changes: Partial<Pick<EntryMethod, "name" | "description" | "isActive">> }
  | { type: "delete-entry-method"; id: string }
  | { type: "close-trading-day"; planDate: string; nextPlanDate: string; carryPlanIds?: number[]; carryMode?: CarryScenarioMode }
  | { type: "reset-trading-plan"; activePlanDate: string }
  | { type: "reset-session"; activePlanDate: string };

export function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        setups: action.payload.setups ?? state.setups,
        entryMethods: action.payload.entryMethods ?? state.entryMethods,
        sessionPlans: action.payload.sessionPlans ?? state.sessionPlans,
        archivedPlans: action.payload.archivedPlans ?? state.archivedPlans,
        instrumentImages: action.payload.instrumentImages ?? state.instrumentImages,
        marketIdeaNotes: action.payload.marketIdeaNotes ?? state.marketIdeaNotes,
        dailyRiskBudgets: action.payload.dailyRiskBudgets ?? state.dailyRiskBudgets,
        tradingDayStatusByDate: action.payload.tradingDayStatusByDate ?? action.payload.tradingDayStatuses ?? state.tradingDayStatusByDate,
        tradingDayStatuses: action.payload.tradingDayStatuses ?? state.tradingDayStatuses,
        riskControlsByDate: action.payload.riskControlsByDate ?? state.riskControlsByDate,
        accountSettings: action.payload.accountSettings ?? state.accountSettings,
        emergencyNotes: action.payload.emergencyNotes ?? state.emergencyNotes,
        emergencyLock: action.payload.emergencyLock ?? state.emergencyLock,
        activePlanDate: action.payload.activePlanDate ?? state.activePlanDate,
        syncKey: action.payload.syncKey ?? state.syncKey,
        lastUpdatedAt: action.payload.lastUpdatedAt ?? state.lastUpdatedAt,
      };
    case "set-active-date":
      return {
        ...state,
        activePlanDate: action.activePlanDate,
        riskControlsByDate: ensureRiskControlsForDate(state.riskControlsByDate, action.activePlanDate),
      };
    case "set-sync-key":
      return { ...state, syncKey: action.syncKey };
    case "add-plan":
      return { ...state, sessionPlans: [...state.sessionPlans, createSessionPlan(state.activePlanDate, action.symbol, Date.now(), getPreferredSetup(state.setups))] };
    case "update-plan":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => {
          if (plan.id !== action.id) return plan;
          if (action.field === "symbol") {
            const symbol = normalizeInstrumentSymbol(String(action.value));
            return { ...plan, symbol, tradePointValue: getPointValuePerLot(symbol) };
          }
          if (action.field === "setupIds") {
            const setupIds = (Array.isArray(action.value) ? action.value : []).filter((value): value is string => typeof value === "string").slice(0, 5);
            const setupNames = getSetupNames(state.setups, setupIds, plan.setupNames);
            return { ...plan, setupIds, setupNames, setupId: setupIds[0] ?? "", setupName: setupNames[0] ?? "" };
          }
          if (action.field === "entryMethodId") {
            const entryMethodId = String(action.value ?? "");
            const entryMethodName = state.entryMethods.find((method) => method.id === entryMethodId)?.name ?? "";
            return { ...plan, entryMethodId, entryMethodName, entryMethod: entryMethodName, trigger: entryMethodName };
          }
          if (action.field === "entryMethod" || action.field === "entryMethodName") {
            const entryMethodName = String(action.value ?? "");
            const matchedMethod = state.entryMethods.find((method) => method.name.toLowerCase() === entryMethodName.toLowerCase());
            return { ...plan, entryMethodId: matchedMethod?.id ?? "", entryMethodName, entryMethod: entryMethodName, trigger: entryMethodName };
          }
          return { ...plan, [action.field]: action.value } as SessionPlan;
        }),
      };
    case "add-trade":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => {
          if (plan.id !== action.scenarioId || !validateScenarioPlan(plan).valid) return plan;
          const trades = Array.isArray(plan.trades) ? plan.trades : [];
          const executionType = trades.length === 0 ? "trade_1" : action.executionType;
          return { ...plan, status: plan.status === "planned" ? "active" : plan.status, trades: [...trades, createScenarioTrade(plan, executionType)] };
        }),
      };
    case "update-trade":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => {
          if (plan.id !== action.scenarioId) return plan;
          const trades = (Array.isArray(plan.trades) ? plan.trades : []).map((trade) => {
            if (trade.id !== action.tradeId) return trade;
            const nextTrade = { ...trade, [action.field]: action.value } as ScenarioTrade;
            if (action.field === "status" && action.value !== "planned" && !nextTrade.executedAt) {
              return { ...nextTrade, executedAt: new Date().toISOString() };
            }
            return nextTrade;
          });
          return syncLegacyResultFields({ ...plan, trades });
        }),
      };
    case "remove-trade":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => {
          if (plan.id !== action.scenarioId) return plan;
          return syncLegacyResultFields({ ...plan, trades: (Array.isArray(plan.trades) ? plan.trades : []).filter((trade) => trade.id !== action.tradeId) });
        }),
      };
    case "remove-plan":
      return { ...state, sessionPlans: state.sessionPlans.filter((plan) => plan.id !== action.id) };
    case "close-plan":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => (plan.id === action.id ? ensureScenarioCloseTrade({ ...plan, status: "closed", closedAt: plan.closedAt || new Date().toISOString() }) : plan)),
      };
    case "reopen-plan":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => (plan.id === action.id ? { ...plan, status: "active", closedAt: "", archivedAt: "" } : plan)),
      };
    case "restore-plan": {
      const planToRestore = state.archivedPlans.find((plan) => plan.id === action.id);
      if (!planToRestore) return state;

      const restoredPlan: SessionPlan = { ...planToRestore, status: "closed" };
      delete (restoredPlan as SessionPlan & Partial<ArchivedPlan>).archivedAt;
      return {
        ...state,
        sessionPlans: [restoredPlan, ...state.sessionPlans],
        archivedPlans: state.archivedPlans.filter((plan) => plan.id !== action.id),
      };
    }
    case "carry-plan":
      return carryPlanToDate(state, action.id, action.nextPlanDate, action.mode);
    case "set-instrument-image":
      return { ...state, instrumentImages: { ...state.instrumentImages, [action.key]: action.value } };
    case "remove-instrument-image": {
      const instrumentImages = { ...state.instrumentImages };
      delete instrumentImages[action.key];
      return { ...state, instrumentImages };
    }
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
    case "set-trading-day-status":
      return {
        ...state,
        tradingDayStatusByDate: { ...state.tradingDayStatusByDate, [action.planDate]: action.status },
        tradingDayStatuses: { ...state.tradingDayStatuses, [action.planDate]: action.status },
      };
    case "set-risk-control": {
      const currentControls = getRiskControlsForDate(state.riskControlsByDate, action.planDate);
      const nextControls = { ...currentControls, [action.field]: action.value, updatedAt: new Date().toISOString() };

      return {
        ...state,
        riskControlsByDate: { ...state.riskControlsByDate, [action.planDate]: nextControls },
        emergencyNotes:
          action.field === "emergencyNote"
            ? { ...state.emergencyNotes, [action.planDate]: String(action.value ?? "") }
            : state.emergencyNotes,
        emergencyLock:
          action.planDate === state.activePlanDate && (action.field === "revenge" || action.field === "lockUntil")
            ? {
                revenge: action.field === "revenge" ? Boolean(action.value) : nextControls.revenge,
                lockUntil: action.field === "lockUntil" ? String(action.value ?? "") : nextControls.lockUntil,
              }
            : state.emergencyLock,
      };
    }
    case "reset-risk-controls":
      return {
        ...state,
        riskControlsByDate: { ...state.riskControlsByDate, [action.planDate]: createDefaultRiskControls({ updatedAt: new Date().toISOString() }) },
        emergencyNotes: { ...state.emergencyNotes, [action.planDate]: "" },
        emergencyLock: action.planDate === state.activePlanDate ? { revenge: false, lockUntil: "" } : state.emergencyLock,
      };
    case "set-account-setting":
      return { ...state, accountSettings: { ...state.accountSettings, [action.field]: action.value } };
    case "set-emergency-note":
      return {
        ...state,
        emergencyNotes: { ...state.emergencyNotes, [action.planDate]: action.value },
        riskControlsByDate: {
          ...state.riskControlsByDate,
          [action.planDate]: {
            ...getRiskControlsForDate(state.riskControlsByDate, action.planDate),
            emergencyNote: action.value,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    case "set-emergency-lock":
      return {
        ...state,
        emergencyLock: { revenge: action.revenge, lockUntil: action.lockUntil },
        riskControlsByDate: {
          ...state.riskControlsByDate,
          [state.activePlanDate]: {
            ...getRiskControlsForDate(state.riskControlsByDate, state.activePlanDate),
            revenge: action.revenge,
            lockUntil: action.lockUntil,
            updatedAt: new Date().toISOString(),
          },
        },
      };
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
    case "add-entry-method": {
      const entryMethod = createCustomEntryMethod({ name: action.name, description: action.description });
      return { ...state, entryMethods: [...state.entryMethods, entryMethod] };
    }
    case "update-entry-method": {
      const now = new Date().toISOString();
      return {
        ...state,
        entryMethods: state.entryMethods.map((method) => (method.id === action.id ? { ...method, ...action.changes, updatedAt: now } : method)),
      };
    }
    case "delete-entry-method":
      return { ...state, entryMethods: state.entryMethods.filter((method) => method.id !== action.id || method.isDefault) };
    case "close-trading-day": {
      const plansToArchive = state.sessionPlans.filter((plan) => plan.planDate === action.planDate);
      const remainingSessionPlans = state.sessionPlans.filter((plan) => plan.planDate !== action.planDate);
      const carryIds = new Set(action.carryPlanIds ?? []);
      const carriedPlans = plansToArchive
        .filter((plan) => carryIds.has(plan.id))
        .map((plan, index) => createCarriedPlan(plan, action.nextPlanDate, action.carryMode ?? "scenario_trade_plan", Date.now() + index + 1));
      const nextDayAlreadyPrepared = remainingSessionPlans.some((plan) => plan.planDate === action.nextPlanDate) || carriedPlans.length > 0;
      const carriedSymbols = new Set(carriedPlans.map((plan) => plan.symbol));

      return {
        ...state,
        activePlanDate: action.planDate,
        tradingDayStatuses: {
          ...state.tradingDayStatuses,
          [action.planDate]: "closed",
          [action.nextPlanDate]: state.tradingDayStatuses[action.nextPlanDate] ?? "active",
        },
        tradingDayStatusByDate: {
          ...state.tradingDayStatusByDate,
          [action.planDate]: "closed",
          [action.nextPlanDate]: state.tradingDayStatusByDate[action.nextPlanDate] ?? "active",
        },
        riskControlsByDate: {
          ...state.riskControlsByDate,
          [action.nextPlanDate]: state.riskControlsByDate[action.nextPlanDate] ?? createDefaultRiskControls({ updatedAt: new Date().toISOString() }),
        },
        emergencyNotes: { ...state.emergencyNotes, [action.nextPlanDate]: state.emergencyNotes[action.nextPlanDate] ?? "" },
        emergencyLock: { revenge: false, lockUntil: "" },
        marketIdeaNotes: plansToArchive
          .filter((plan) => carryIds.has(plan.id))
          .reduce(
          (notes, plan) => copyMarketIdeaNotes(notes, action.planDate, action.nextPlanDate, plan.symbol),
          state.marketIdeaNotes
        ),
        instrumentImages:
          action.carryMode === "scenario_image"
            ? [...carriedSymbols].reduce((images, symbol) => copyInstrumentImage(images, action.planDate, action.nextPlanDate, symbol), state.instrumentImages)
            : state.instrumentImages,
        archivedPlans: [
          ...plansToArchive.map((plan) => archiveScenarioForDay(plan, state, action.planDate)),
          ...state.archivedPlans,
        ],
        sessionPlans: nextDayAlreadyPrepared ? [...carriedPlans, ...remainingSessionPlans] : [createSessionPlan(action.nextPlanDate, DEFAULT_INSTRUMENT_SYMBOL, Date.now(), getPreferredSetup(state.setups)), ...remainingSessionPlans],
      };
    }
    case "reset-trading-plan":
      return {
        ...state,
        sessionPlans: [
          createSessionPlan(action.activePlanDate, DEFAULT_INSTRUMENT_SYMBOL, Date.now(), getPreferredSetup(state.setups)),
          ...state.sessionPlans.filter((plan) => plan.planDate !== action.activePlanDate),
        ],
      };
    case "reset-session":
      return {
        ...state,
        sessionPlans: [createSessionPlan(action.activePlanDate, DEFAULT_INSTRUMENT_SYMBOL, 1, getPreferredSetup(state.setups))],
        archivedPlans: [],
      };
    default:
      return state;
  }
}

function ensureRiskControlsForDate(riskControlsByDate: PlanningState["riskControlsByDate"], planDate: string) {
  if (riskControlsByDate[planDate]) return riskControlsByDate;
  return { ...riskControlsByDate, [planDate]: createDefaultRiskControls({ updatedAt: new Date().toISOString() }) };
}

function preserveScenarioLabels(plan: SessionPlan, setups: Setup[], entryMethods: EntryMethod[]): SessionPlan {
  const setupIds = Array.isArray(plan.setupIds) ? plan.setupIds.slice(0, 5) : [];
  const setupNames = getSetupNames(setups, setupIds, getPlanSetupNames(plan)).slice(0, 5);
  const entryMethodName = getPlanEntryMethod(plan);
  const entryMethodId = plan.entryMethodId || entryMethods.find((method) => method.name.toLowerCase() === entryMethodName.toLowerCase())?.id || "";

  return syncLegacyResultFields({
    ...plan,
    setupIds,
    setupNames,
    setupId: setupIds[0] ?? "",
    setupName: setupNames[0] ?? "",
    entryMethodId,
    entryMethodName,
    entryMethod: entryMethodName,
    trigger: plan.trigger || entryMethodName,
  });
}

function archiveScenarioForDay(plan: SessionPlan, state: PlanningState, planDate: string): ArchivedPlan {
  const archivedAt = new Date().toISOString();
  const chartImageKey = getInstrumentImageKey(planDate, plan.symbol);
  const chartImage = state.instrumentImages[chartImageKey] ?? plan.chartImage ?? "";
  const closedPlan = ensureScenarioCloseTrade({
    ...plan,
    status: "archived",
    closedAt: plan.closedAt || archivedAt,
    archivedAt,
    chartImage,
    chartImageKey,
  });

  return {
    ...preserveScenarioLabels(closedPlan, state.setups, state.entryMethods),
    status: "archived",
    archivedAt,
    chartImage,
    chartImageKey,
  };
}

function carryPlanToDate(state: PlanningState, planId: number, nextPlanDate: string, mode: CarryScenarioMode): PlanningState {
  const plan = state.sessionPlans.find((item) => item.id === planId);
  if (!plan) return state;

  const carriedPlan = createCarriedPlan(plan, nextPlanDate, mode);

  return {
    ...state,
    sessionPlans: [carriedPlan, ...state.sessionPlans],
    marketIdeaNotes: copyMarketIdeaNotes(state.marketIdeaNotes, plan.planDate, nextPlanDate, plan.symbol),
    instrumentImages: mode === "scenario_image" ? copyInstrumentImage(state.instrumentImages, plan.planDate, nextPlanDate, plan.symbol) : state.instrumentImages,
    emergencyNotes: { ...state.emergencyNotes, [nextPlanDate]: "" },
  };
}

function createCarriedPlan(plan: SessionPlan, nextPlanDate: string, mode: CarryScenarioMode, id = Date.now()): SessionPlan {
  const withTradePlan = mode === "scenario_trade_plan";

  return {
    ...plan,
    id,
    planDate: nextPlanDate,
    status: "planned",
    closedAt: "",
    archivedAt: "",
    closeComment: "",
    chartImage: "",
    chartImageKey: "",
    originScenarioId: plan.originScenarioId ?? plan.id,
    carriedFromDate: plan.planDate,
    carryCount: (Number(plan.carryCount) || 0) + 1,
    resultStatus: "not_taken",
    technical: "yes",
    finalResult: "",
    archiveComment: "",
    trades: [],
    tradeEntry: withTradePlan ? plan.tradeEntry : "",
    tradeStop: withTradePlan ? plan.tradeStop : "",
    tradeTake: withTradePlan ? plan.tradeTake : "",
    tradeRisk: withTradePlan ? plan.tradeRisk : "",
    tradePointValue: withTradePlan ? plan.tradePointValue : getPointValuePerLot(plan.symbol),
  };
}

function copyMarketIdeaNotes(notes: PlanningState["marketIdeaNotes"], fromDate: string, toDate: string, symbol: string) {
  const nextNotes = { ...notes };

  for (const field of ["bias", "scenario"] as const) {
    const fromKey = `${fromDate}:${symbol}:${field}`;
    const toKey = `${toDate}:${symbol}:${field}`;
    if (notes[fromKey] !== undefined && nextNotes[toKey] === undefined) {
      nextNotes[toKey] = notes[fromKey];
    }
  }

  return nextNotes;
}

function copyInstrumentImage(images: PlanningState["instrumentImages"], fromDate: string, toDate: string, symbol: string) {
  const fromKey = getInstrumentImageKey(fromDate, symbol);
  const toKey = getInstrumentImageKey(toDate, symbol);
  if (!images[fromKey] || images[toKey]) return images;
  return { ...images, [toKey]: images[fromKey] };
}


export function useTradeGateState() {
  return useReducer(planningReducer, initialPlanningState);
}
