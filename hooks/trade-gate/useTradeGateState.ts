import { useReducer } from "react";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_TRADE_ARGUMENTS } from "@/constants/trade-gate";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import {
  createCustomTradeArgument,
  createDefaultRiskControls,
  createScenarioTrade,
  createSessionPlan,
  dedupeTextList,
  ensureScenarioCloseTrade,
  getInitialPlanDate,
  getInstrumentImageKey,
  getPlanArgumentNames,
  getRiskControlsForDate,
  getTradeArgumentNames,
  normalizeScenarioArguments,
  mergeTradingDayStatuses,
  syncLegacyResultFields,
  validateScenarioPlan,
} from "@/components/trade-gate/utils";
import type {
  AccountSettings,
  ArchivedPlan,
  CarryScenarioMode,
  EditablePlanField,
  EditableTradeField,
  PlanningState,
  RiskControlField,
  RiskControlState,
  ScenarioTrade,
  SessionPlan,
  TradeExecutionType,
  TradeArgument,
  TradingDayStatus,
} from "@/types/trade-gate";

const initialPlanDate = getInitialPlanDate();

export const initialPlanningState: PlanningState = {
  tradeArguments: DEFAULT_TRADE_ARGUMENTS,
  setups: DEFAULT_TRADE_ARGUMENTS,
  sessionPlans: [createSessionPlan(initialPlanDate, DEFAULT_INSTRUMENT_SYMBOL, 1)],
  archivedPlans: [],
  instrumentImages: {},
  marketIdeaNotes: {},
  dailyRiskBudgets: {},
  tradingDayStatusByDate: {},
  tradingDayStatuses: {},
  tradingDayReopenedAtByDate: {},
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
  | { type: "carry-scenario"; id: number; nextPlanDate: string; mode: CarryScenarioMode }
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
  | { type: "add-trade-argument"; name: string }
  | { type: "update-trade-argument"; id: string; name: string }
  | { type: "delete-trade-argument"; id: string }
  | { type: "close-trading-day"; planDate: string; nextPlanDate: string; carryPlanIds?: number[]; carryMode?: CarryScenarioMode }
  | { type: "reset-trading-plan"; activePlanDate: string }
  | { type: "reset-session"; activePlanDate: string };

export function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
  switch (action.type) {
    case "hydrate": {
      const hydratedTradingDayStatuses = mergeTradingDayStatuses(
        state.tradingDayStatuses,
        state.tradingDayStatusByDate,
        action.payload.tradingDayStatuses,
        action.payload.tradingDayStatusByDate
      );
      return {
        ...state,
        tradeArguments: action.payload.tradeArguments ?? action.payload.setups ?? state.tradeArguments,
        setups: action.payload.tradeArguments ?? action.payload.setups ?? state.tradeArguments,
        sessionPlans: action.payload.sessionPlans ?? state.sessionPlans,
        archivedPlans: action.payload.archivedPlans ?? state.archivedPlans,
        instrumentImages: action.payload.instrumentImages ?? state.instrumentImages,
        marketIdeaNotes: action.payload.marketIdeaNotes ?? state.marketIdeaNotes,
        dailyRiskBudgets: action.payload.dailyRiskBudgets ?? state.dailyRiskBudgets,
        tradingDayStatusByDate: hydratedTradingDayStatuses,
        tradingDayStatuses: hydratedTradingDayStatuses,
        tradingDayReopenedAtByDate: action.payload.tradingDayReopenedAtByDate ?? state.tradingDayReopenedAtByDate,
        riskControlsByDate: action.payload.riskControlsByDate ?? state.riskControlsByDate,
        accountSettings: action.payload.accountSettings ?? state.accountSettings,
        emergencyNotes: action.payload.emergencyNotes ?? state.emergencyNotes,
        emergencyLock: action.payload.emergencyLock ?? state.emergencyLock,
        activePlanDate: action.payload.activePlanDate ?? state.activePlanDate,
        syncKey: action.payload.syncKey ?? state.syncKey,
        lastUpdatedAt: action.payload.lastUpdatedAt ?? state.lastUpdatedAt,
      };
    }
    case "set-active-date":
      return {
        ...state,
        activePlanDate: action.activePlanDate,
        riskControlsByDate: ensureRiskControlsForDate(state.riskControlsByDate, action.activePlanDate),
      };
    case "set-sync-key":
      return { ...state, syncKey: action.syncKey };
    case "add-plan":
      return { ...state, sessionPlans: [...state.sessionPlans, createSessionPlan(state.activePlanDate, action.symbol, Date.now())] };
    case "update-plan":
      return {
        ...state,
        sessionPlans: state.sessionPlans.map((plan) => {
          if (plan.id !== action.id) return plan;
          if (action.field === "symbol") {
            const symbol = normalizeInstrumentSymbol(String(action.value));
            return { ...plan, symbol, tradePointValue: getPointValuePerLot(symbol) };
          }
          if (action.field === "argumentIds" || action.field === "setupIds") {
            const argumentIds = dedupeTextList(Array.isArray(action.value) ? action.value : []).slice(0, 5);
            const argumentNames = getTradeArgumentNames(state.tradeArguments, argumentIds, plan.argumentNames ?? plan.setupNames);
            return { ...plan, argumentIds, argumentNames, setupIds: argumentIds, setupNames: argumentNames, setupId: argumentIds[0] ?? "", setupName: argumentNames[0] ?? "" };
          }
          if (action.field === "entryMethod") {
            return { ...plan, entryMethod: String(action.value ?? ""), entryType: undefined };
          }
          if (action.field === "arguments") {
            return { ...plan, arguments: normalizeScenarioArguments(action.value) };
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
    case "carry-scenario":
      return carryScenarioToDate(state, action.id, action.nextPlanDate, action.mode);
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
        tradingDayReopenedAtByDate:
          action.status === "active"
            ? { ...state.tradingDayReopenedAtByDate, [action.planDate]: new Date().toISOString() }
            : omitDateKey(state.tradingDayReopenedAtByDate, action.planDate),
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
    case "add-trade-argument": {
      const name = action.name.trim();
      if (!name || state.tradeArguments.some((argument) => argument.name.trim().toLowerCase() === name.toLowerCase())) return state;
      const tradeArgument = createCustomTradeArgument({ name });
      const tradeArguments = [...state.tradeArguments, tradeArgument];
      return { ...state, tradeArguments, setups: tradeArguments };
    }
    case "update-trade-argument": {
      const name = action.name.trim();
      if (!name || state.tradeArguments.some((argument) => argument.id !== action.id && argument.name.trim().toLowerCase() === name.toLowerCase())) return state;
      const now = new Date().toISOString();
      const previousName = state.tradeArguments.find((argument) => argument.id === action.id)?.name ?? "";
      const tradeArguments = state.tradeArguments.map((argument) => (argument.id === action.id ? { ...argument, name, updatedAt: now } : argument));
      return {
        ...state,
        tradeArguments,
        setups: tradeArguments,
        sessionPlans: state.sessionPlans.map((plan) => renameArgumentInPlan(plan, previousName, name, tradeArguments)),
        archivedPlans: state.archivedPlans.map((plan) => renameArgumentInPlan(plan, previousName, name, tradeArguments)),
      };
    }
    case "delete-trade-argument": {
      const deletedArgument = state.tradeArguments.find((argument) => argument.id === action.id);
      const tradeArguments = state.tradeArguments.filter((argument) => argument.id !== action.id);
      return {
        ...state,
        tradeArguments,
        setups: tradeArguments,
        sessionPlans: state.sessionPlans.map((plan) => removeArgumentFromPlan(plan, action.id, deletedArgument?.name ?? "", tradeArguments)),
        archivedPlans: state.archivedPlans.map((plan) => removeArgumentFromPlan(plan, action.id, deletedArgument?.name ?? "", tradeArguments)),
      };
    }
    case "close-trading-day": {
      const plansToArchive = state.sessionPlans.filter((plan) => plan.planDate === action.planDate);
      const remainingSessionPlans = state.sessionPlans.filter((plan) => plan.planDate !== action.planDate);
      const carryIds = new Set(action.carryPlanIds ?? []);
      const carriedPlans = plansToArchive
        .filter((plan) => carryIds.has(plan.id))
        .map((plan, index) => createCarriedScenario(plan, action.nextPlanDate, action.carryMode ?? "scenario_trade_plan", Date.now() + index + 1));
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
        tradingDayReopenedAtByDate: omitDateKey(state.tradingDayReopenedAtByDate, action.planDate),
        riskControlsByDate: {
          ...state.riskControlsByDate,
          [action.nextPlanDate]: state.riskControlsByDate[action.nextPlanDate] ?? createDefaultRiskControls({ updatedAt: new Date().toISOString() }),
        },
        emergencyNotes: { ...state.emergencyNotes, [action.nextPlanDate]: state.emergencyNotes[action.nextPlanDate] ?? "" },
        emergencyLock: { revenge: false, lockUntil: "" },
        marketIdeaNotes: state.marketIdeaNotes,
        instrumentImages:
          action.carryMode === "scenario_image"
            ? [...carriedSymbols].reduce((images, symbol) => copyInstrumentImage(images, action.planDate, action.nextPlanDate, symbol), state.instrumentImages)
            : state.instrumentImages,
        archivedPlans: [
          ...plansToArchive.map((plan) => archiveScenarioForDay(plan, state, action.planDate)),
          ...state.archivedPlans,
        ],
        sessionPlans: nextDayAlreadyPrepared ? [...carriedPlans, ...remainingSessionPlans] : [createSessionPlan(action.nextPlanDate, DEFAULT_INSTRUMENT_SYMBOL, Date.now()), ...remainingSessionPlans],
      };
    }
    case "reset-trading-plan":
      return {
        ...state,
        sessionPlans: [
          createSessionPlan(action.activePlanDate, DEFAULT_INSTRUMENT_SYMBOL, Date.now()),
          ...state.sessionPlans.filter((plan) => plan.planDate !== action.activePlanDate),
        ],
      };
    case "reset-session":
      return {
        ...state,
        sessionPlans: [createSessionPlan(action.activePlanDate, DEFAULT_INSTRUMENT_SYMBOL, 1)],
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

function preserveScenarioLabels(plan: SessionPlan, tradeArguments: TradeArgument[]): SessionPlan {
  const argumentIds = dedupeTextList(Array.isArray(plan.argumentIds) ? plan.argumentIds : Array.isArray(plan.setupIds) ? plan.setupIds : []).slice(0, 5);
  const argumentNames = dedupeTextList(getTradeArgumentNames(tradeArguments, argumentIds, getPlanArgumentNames(plan))).slice(0, 5);

  return syncLegacyResultFields({
    ...plan,
    argumentIds,
    argumentNames,
    arguments: normalizeScenarioArguments(plan.arguments),
    setupIds: argumentIds,
    setupNames: argumentNames,
    setupId: argumentIds[0] ?? "",
    setupName: argumentNames[0] ?? "",
  });
}

function renameArgumentInPlan<T extends SessionPlan>(plan: T, previousName: string, nextName: string, tradeArguments: TradeArgument[]): T {
  const argumentIds = dedupeTextList(plan.argumentIds).filter((id) => tradeArguments.some((argument) => argument.id === id));
  const argumentNames = dedupeTextList(getTradeArgumentNames(tradeArguments, argumentIds, [])).slice(0, 5);
  const argumentsList = normalizeScenarioArguments(plan.arguments).map((argument) => (argument.toLowerCase() === previousName.trim().toLowerCase() ? nextName : argument));

  return {
    ...plan,
    argumentIds,
    argumentNames,
    arguments: normalizeScenarioArguments(argumentsList),
    setupIds: argumentIds,
    setupNames: argumentNames,
    setupId: argumentIds[0] ?? "",
    setupName: argumentNames[0] ?? "",
  } as T;
}

function removeArgumentFromPlan<T extends SessionPlan>(plan: T, argumentId: string, argumentName: string, tradeArguments: TradeArgument[]): T {
  const normalizedName = argumentName.trim().toLowerCase();
  const argumentIds = dedupeTextList(plan.argumentIds).filter((id) => id !== argumentId && tradeArguments.some((argument) => argument.id === id));
  const argumentNames = dedupeTextList(getTradeArgumentNames(tradeArguments, argumentIds, [])).slice(0, 5);
  const argumentsList = normalizeScenarioArguments(plan.arguments).filter((argument) => argument.trim().toLowerCase() !== normalizedName);

  return {
    ...plan,
    argumentIds,
    argumentNames,
    arguments: argumentsList,
    setupIds: argumentIds,
    setupNames: argumentNames,
    setupId: argumentIds[0] ?? "",
    setupName: argumentNames[0] ?? "",
  } as T;
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
    ...preserveScenarioLabels(closedPlan, state.tradeArguments),
    status: "archived",
    archivedAt,
    chartImage,
    chartImageKey,
  };
}

function carryScenarioToDate(state: PlanningState, scenarioId: number, nextPlanDate: string, mode: CarryScenarioMode): PlanningState {
  const scenario = state.sessionPlans.find((item) => item.id === scenarioId);
  if (!scenario) return state;

  const carriedScenario = createCarriedScenario(scenario, nextPlanDate, mode);

  return {
    ...state,
    sessionPlans: [carriedScenario, ...state.sessionPlans],
    instrumentImages: mode === "scenario_image" ? copyInstrumentImage(state.instrumentImages, scenario.planDate, nextPlanDate, scenario.symbol) : state.instrumentImages,
    emergencyNotes: { ...state.emergencyNotes, [nextPlanDate]: "" },
  };
}

function createCarriedScenario(plan: SessionPlan, nextPlanDate: string, mode: CarryScenarioMode, id = Date.now()): SessionPlan {
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
    arguments: normalizeScenarioArguments(plan.arguments),
    tradeEntry: withTradePlan ? plan.tradeEntry : "",
    tradeStop: withTradePlan ? plan.tradeStop : "",
    tradeTake: withTradePlan ? plan.tradeTake : "",
    tradeRisk: withTradePlan ? plan.tradeRisk : "",
    tradePointValue: withTradePlan ? plan.tradePointValue : getPointValuePerLot(plan.symbol),
  };
}

function copyInstrumentImage(images: PlanningState["instrumentImages"], fromDate: string, toDate: string, symbol: string) {
  const fromKey = getInstrumentImageKey(fromDate, symbol);
  const toKey = getInstrumentImageKey(toDate, symbol);
  if (!images[fromKey] || images[toKey]) return images;
  return { ...images, [toKey]: images[fromKey] };
}

function omitDateKey<T>(record: Record<string, T>, date: string) {
  const next = { ...record };
  delete next[date];
  return next;
}

export function useTradeGateState() {
  return useReducer(planningReducer, initialPlanningState);
}
