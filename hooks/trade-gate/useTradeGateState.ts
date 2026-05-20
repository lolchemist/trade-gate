import { useReducer } from "react";
import { DEFAULT_SETUPS } from "@/constants/trade-gate";
import { createCustomSetup, createSessionPlan, getInitialPlanDate, getPreferredSetup, getSetupName } from "@/components/trade-gate/utils";
import type { AccountSettings, ArchivedPlan, EditablePlanField, PlanningState, SessionPlan, Setup, TradeCalculatorState } from "@/types/trade-gate";

const initialPlanDate = getInitialPlanDate();

export const initialPlanningState: PlanningState = {
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
  | { type: "set-instrument-image"; key: string; value: string }
  | { type: "set-market-idea-note"; key: string; value: string }
  | { type: "set-daily-risk-budget"; planDate: string; budgetUsd: string }
  | { type: "set-account-setting"; field: keyof AccountSettings; value: string }
  | { type: "set-emergency-note"; planDate: string; value: string }
  | { type: "set-emergency-lock"; revenge: boolean; lockUntil: string }
  | { type: "add-setup"; name: string; description: string; defaultInstrument: string }
  | { type: "update-setup"; id: string; changes: Partial<Pick<Setup, "name" | "description" | "defaultInstrument" | "isActive">> }
  | { type: "delete-setup"; id: string }
  | { type: "close-trading-day"; planDate: string; nextPlanDate: string }
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
        accountSettings: action.payload.accountSettings ?? state.accountSettings,
        emergencyNotes: action.payload.emergencyNotes ?? state.emergencyNotes,
        emergencyLock: action.payload.emergencyLock ?? state.emergencyLock,
        activePlanDate: action.payload.activePlanDate ?? state.activePlanDate,
        syncKey: action.payload.syncKey ?? state.syncKey,
        lastUpdatedAt: action.payload.lastUpdatedAt ?? state.lastUpdatedAt,
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
    case "set-emergency-lock":
      return { ...state, emergencyLock: { revenge: action.revenge, lockUntil: action.lockUntil } };
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


export function useTradeGateState() {
  return useReducer(planningReducer, initialPlanningState);
}
