import { useReducer } from "react";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_SETUPS } from "@/constants/trade-gate";
import { createCustomSetup, createDefaultRiskControls, createSessionPlan, getInitialPlanDate, getPreferredSetup, getRiskControlsForDate, getSetupName } from "@/components/trade-gate/utils";
import type { AccountSettings, ArchivedPlan, CarryScenarioMode, EditablePlanField, PlanningState, RiskControlField, RiskControlState, SessionPlan, Setup, TradeCalculatorState } from "@/types/trade-gate";

const initialPlanDate = getInitialPlanDate();

export const initialPlanningState: PlanningState = {
  setups: DEFAULT_SETUPS,
  sessionPlans: [createSessionPlan(initialPlanDate, "BCOUSD", 1, DEFAULT_SETUPS[0])],
  archivedPlans: [],
  instrumentImages: {},
  marketIdeaNotes: {},
  dailyRiskBudgets: {},
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

export const initialCalculatorState: TradeCalculatorState = {
  symbol: "BCOUSD",
  direction: "long",
  entryReason: "",
  entryPrice: 85,
  stopPrice: 84.6,
  takePrice: 86,
  riskDollars: 500,
  dollarsPerPointPerLot: 1000,
};

export type PlanningAction =
  | { type: "hydrate"; payload: Partial<PlanningState> }
  | { type: "set-active-date"; activePlanDate: string }
  | { type: "set-sync-key"; syncKey: string }
  | { type: "add-plan"; symbol: string }
  | { type: "update-plan"; id: number; field: EditablePlanField; value: SessionPlan[EditablePlanField] }
  | { type: "remove-plan"; id: number }
  | { type: "archive-plan"; id: number }
  | { type: "restore-plan"; id: number }
  | { type: "carry-plan"; id: number; nextPlanDate: string; mode: CarryScenarioMode }
  | { type: "set-instrument-image"; key: string; value: string }
  | { type: "set-market-idea-note"; key: string; value: string }
  | { type: "set-daily-risk-budget"; planDate: string; budgetUsd: string }
  | { type: "set-risk-control"; planDate: string; field: RiskControlField; value: RiskControlState[RiskControlField] }
  | { type: "reset-risk-controls"; planDate: string }
  | { type: "set-account-setting"; field: keyof AccountSettings; value: string }
  | { type: "set-emergency-note"; planDate: string; value: string }
  | { type: "set-emergency-lock"; revenge: boolean; lockUntil: string }
  | { type: "add-setup"; name: string; description: string; defaultInstrument: string }
  | { type: "update-setup"; id: string; changes: Partial<Pick<Setup, "name" | "description" | "defaultInstrument" | "isActive">> }
  | { type: "delete-setup"; id: string }
  | { type: "close-trading-day"; planDate: string; nextPlanDate: string; carryPlanIds?: number[]; carryMode?: CarryScenarioMode }
  | { type: "reset-trading-plan"; activePlanDate: string }
  | { type: "reset-session"; activePlanDate: string };

export function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
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
    case "carry-plan":
      return carryPlanToDate(state, action.id, action.nextPlanDate, action.mode);
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
        activePlanDate: action.nextPlanDate,
        riskControlsByDate: {
          ...state.riskControlsByDate,
          [action.nextPlanDate]: createDefaultRiskControls({ updatedAt: new Date().toISOString() }),
        },
        emergencyNotes: { ...state.emergencyNotes, [action.nextPlanDate]: "" },
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
          ...plansToArchive.map((plan) => ({
            ...plan,
            setupName: getSetupName(state.setups, plan.setupId, plan.setupName),
            archivedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          })),
          ...state.archivedPlans,
        ],
        sessionPlans: nextDayAlreadyPrepared ? [...carriedPlans, ...remainingSessionPlans] : [createSessionPlan(action.nextPlanDate, "BCOUSD", Date.now(), getPreferredSetup(state.setups)), ...remainingSessionPlans],
      };
    }
    case "reset-trading-plan":
      return {
        ...state,
        sessionPlans: [
          createSessionPlan(action.activePlanDate, "BCOUSD", Date.now(), getPreferredSetup(state.setups)),
          ...state.sessionPlans.filter((plan) => plan.planDate !== action.activePlanDate),
        ],
      };
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

function ensureRiskControlsForDate(riskControlsByDate: PlanningState["riskControlsByDate"], planDate: string) {
  if (riskControlsByDate[planDate]) return riskControlsByDate;
  return { ...riskControlsByDate, [planDate]: createDefaultRiskControls({ updatedAt: new Date().toISOString() }) };
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
    originScenarioId: plan.originScenarioId ?? plan.id,
    carriedFromDate: plan.planDate,
    carryCount: (Number(plan.carryCount) || 0) + 1,
    resultStatus: "not_taken",
    technical: "yes",
    finalResult: "",
    archiveComment: "",
    tradeEntry: withTradePlan ? plan.tradeEntry : "",
    tradeStop: withTradePlan ? plan.tradeStop : "",
    tradeTake: withTradePlan ? plan.tradeTake : "",
    tradeRisk: withTradePlan ? plan.tradeRisk : "",
    tradePointValue: withTradePlan ? plan.tradePointValue : "",
    entryReason: withTradePlan ? plan.entryReason : "",
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
  const fromKey = `${fromDate}:${symbol}`;
  const toKey = `${toDate}:${symbol}`;
  if (!images[fromKey] || images[toKey]) return images;
  return { ...images, [toKey]: images[fromKey] };
}


export function useTradeGateState() {
  return useReducer(planningReducer, initialPlanningState);
}
