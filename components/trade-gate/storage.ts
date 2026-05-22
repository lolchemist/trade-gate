import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_SETUPS, STORAGE_KEY } from "./constants";
import { createDefaultRiskControls, createSessionPlan, getInitialPlanDate } from "./utils";
import type { ArchivedPlan, CloudPayload, PlanningState, RiskControlState, SessionPlan, Setup, StorageLoadResult, StorageSaveResult } from "./types";

type CloudStateRow = {
  data: unknown;
  updated_at: string | null;
};

type CloudTimestampRow = {
  updated_at: string | null;
};

type StorageConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const TABLE_NAME = "trade_gate_state";
const DEFAULT_SYNC_KEY = "nataliia-main";

export function createTradeGateStorage(config: StorageConfig) {
  const supabase = createSupabaseClient(config);

  return {
    isCloudConfigured: Boolean(supabase),
    loadLocal(defaultState: PlanningState): StorageLoadResult {
      const localResult = readLocalState(defaultState);

      if (localResult.found) {
        return {
          state: localResult.state,
          source: "localStorage",
          message: "Saved locally",
        };
      }

      return {
        state: normalizePlanningState(defaultState),
        source: "default",
        message: "Saved locally",
      };
    },
    async loadLatest(syncKey: string, currentState: PlanningState, defaultState: PlanningState): Promise<StorageLoadResult> {
      if (!supabase) {
        return {
          state: currentState,
          source: "localStorage",
          message: "Offline / Supabase unavailable",
        };
      }

      let cloudResult: StorageLoadResult | null = null;
      try {
        cloudResult = await loadFromSupabase(supabase, syncKey, defaultState);
      } catch {
        return {
          state: currentState,
          source: "localStorage",
          message: "Offline / Supabase unavailable",
        };
      }
      if (!cloudResult) {
        return {
          state: currentState,
          source: "localStorage",
          message: "Saved locally",
        };
      }

      const cloudTime = Date.parse(cloudResult.state.lastUpdatedAt || "");
      const localTime = Date.parse(currentState.lastUpdatedAt || "");

      if (Number.isFinite(cloudTime) && cloudTime > (Number.isFinite(localTime) ? localTime : 0)) {
        writeLocalState(cloudResult.state);
        return cloudResult;
      }

      return {
        state: currentState,
        source: "localStorage",
        message: "Saved locally",
      };
    },
    async load(syncKey: string, defaultState: PlanningState): Promise<StorageLoadResult> {
      if (supabase) {
        try {
          const cloudResult = await loadFromSupabase(supabase, syncKey, defaultState);
          if (cloudResult) {
            writeLocalState(cloudResult.state);
            return cloudResult;
          }
        } catch {
          const localResult = readLocalState({ ...defaultState, syncKey });
          return {
            state: localResult.state,
            source: "localStorage",
            message: "Offline / Supabase unavailable",
          };
        }
      }

      const localResult = readLocalState({ ...defaultState, syncKey });
      return {
        state: localResult.state,
        source: localResult.found ? "localStorage" : "default",
        message: localResult.found
          ? supabase
            ? "Saved locally"
            : "Offline / Supabase unavailable"
          : supabase
            ? "Saved locally"
            : "Offline / Supabase unavailable",
      };
    },
    async save(state: PlanningState): Promise<StorageSaveResult> {
      const currentState = normalizePlanningState(state);

      if (supabase) {
        const conflict = await getCloudConflict(supabase, currentState.syncKey, currentState.lastUpdatedAt);
        if (conflict) {
          writeLocalState(currentState);
          return {
            source: "localStorage",
            message: conflict,
            state: currentState,
            status: "Sync error",
          };
        }

        const now = new Date().toISOString();
        const normalizedState = normalizePlanningState({ ...currentState, lastUpdatedAt: now });
        const { error } = await supabase.from(TABLE_NAME).upsert(
          {
            user_key: normalizedState.syncKey,
            data: toCloudPayload(normalizedState),
            updated_at: now,
          },
          { onConflict: "user_key" }
        );

        if (!error) {
          writeLocalState(normalizedState);
          return {
            source: "supabase",
            message: "Synced",
            state: normalizedState,
            status: "Synced",
          };
        }

        writeLocalState(normalizedState);
        return {
          source: "localStorage",
          message: `Sync error: ${error.message}`,
          state: normalizedState,
          status: "Sync error",
        };
      }

      const now = new Date().toISOString();
      const normalizedState = normalizePlanningState({ ...currentState, lastUpdatedAt: now });
      writeLocalState(normalizedState);
      return {
        source: "localStorage",
        message: "Offline / Supabase unavailable",
        state: normalizedState,
        status: "Offline / Supabase unavailable",
      };
    },
  };
}

function createSupabaseClient(config: StorageConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function getCloudConflict(supabase: SupabaseClient, syncKey: string, localLastUpdatedAt: string) {
  const { data, error } = await supabase.from(TABLE_NAME).select("updated_at").eq("user_key", syncKey).maybeSingle<CloudTimestampRow>();
  if (error || !data?.updated_at) return "";

  const cloudTime = Date.parse(data.updated_at);
  const localTime = Date.parse(localLastUpdatedAt || "");

  if (Number.isFinite(cloudTime) && cloudTime > (Number.isFinite(localTime) ? localTime : 0) + 1000) {
    return "Sync error: в облаке есть более свежие данные. Загрузите из облака перед сохранением.";
  }

  return "";
}

async function loadFromSupabase(supabase: SupabaseClient, syncKey: string, defaultState: PlanningState): Promise<StorageLoadResult | null> {
  const { data, error } = await supabase.from(TABLE_NAME).select("data, updated_at").eq("user_key", syncKey).maybeSingle<CloudStateRow>();

  if (error) throw error;
  if (!data?.data) return null;

  return {
    state: normalizePlanningState({ ...(data.data as Partial<PlanningState>), syncKey, lastUpdatedAt: (data.data as Partial<PlanningState>).lastUpdatedAt ?? data.updated_at ?? undefined }, defaultState),
    source: "supabase",
    message: "Synced",
  };
}

function readLocalState(defaultState: PlanningState): { state: PlanningState; found: boolean } {
  if (typeof window === "undefined") return { state: defaultState, found: false };

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { state: defaultState, found: false };
    return { state: normalizePlanningState(JSON.parse(saved) as Partial<PlanningState>, defaultState), found: true };
  } catch (error) {
    console.error("Failed to load saved Trade Gate state", error);
    return { state: defaultState, found: false };
  }
}

function writeLocalState(state: PlanningState) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePlanningState(state)));
  } catch (error) {
    console.error("Failed to save Trade Gate state", error);
  }
}

function normalizePlanningState(state: Partial<PlanningState>, defaultState?: PlanningState): PlanningState {
  const fallbackDate = defaultState?.activePlanDate ?? getInitialPlanDate();
  const activePlanDate = state.activePlanDate ?? defaultState?.activePlanDate ?? fallbackDate;
  const setups = normalizeSetups(state.setups, defaultState?.setups);
  const sessionPlans = normalizeSessionPlans(state.sessionPlans, fallbackDate, setups);
  const emergencyNotes = state.emergencyNotes ?? defaultState?.emergencyNotes ?? {};
  const emergencyLock = state.emergencyLock ?? defaultState?.emergencyLock ?? { revenge: false, lockUntil: "" };
  const riskControlsByDate = normalizeRiskControlsByDate(state.riskControlsByDate, defaultState?.riskControlsByDate, activePlanDate, emergencyNotes, emergencyLock);

  return {
    setups,
    sessionPlans: sessionPlans.length > 0 ? sessionPlans : [createSessionPlan(fallbackDate, "BCOUSD", 1)],
    archivedPlans: normalizeArchivedPlans(state.archivedPlans, fallbackDate, setups),
    instrumentImages: state.instrumentImages ?? defaultState?.instrumentImages ?? {},
    marketIdeaNotes: state.marketIdeaNotes ?? defaultState?.marketIdeaNotes ?? {},
    dailyRiskBudgets: state.dailyRiskBudgets ?? defaultState?.dailyRiskBudgets ?? {},
    riskControlsByDate,
    accountSettings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(defaultState?.accountSettings ?? {}), ...(state.accountSettings ?? {}) },
    emergencyNotes,
    emergencyLock,
    activePlanDate,
    syncKey: state.syncKey ?? defaultState?.syncKey ?? DEFAULT_SYNC_KEY,
    lastUpdatedAt: state.lastUpdatedAt ?? defaultState?.lastUpdatedAt ?? "",
  };
}

function normalizeRiskControlsByDate(
  controls: Record<string, RiskControlState> | undefined,
  defaultControls: Record<string, RiskControlState> | undefined,
  activePlanDate: string,
  emergencyNotes: Record<string, string>,
  emergencyLock: PlanningState["emergencyLock"]
) {
  const merged = { ...(defaultControls ?? {}), ...(controls ?? {}) };
  const normalized = Object.fromEntries(Object.entries(merged).map(([date, value]) => [date, normalizeRiskControls(value, emergencyNotes[date])])) as Record<string, RiskControlState>;

  if (!normalized[activePlanDate]) {
    normalized[activePlanDate] = createDefaultRiskControls({
      revenge: emergencyLock.revenge,
      lockUntil: emergencyLock.lockUntil,
      emergencyNote: emergencyNotes[activePlanDate] ?? "",
    });
  }

  return normalized;
}

function normalizeRiskControls(value: Partial<RiskControlState> | undefined, fallbackEmergencyNote = ""): RiskControlState {
  return createDefaultRiskControls({
    ...value,
    sleep: Number(value?.sleep ?? 7),
    anxiety: Number(value?.anxiety ?? 5),
    urge: Number(value?.urge ?? 5),
    anger: Number(value?.anger ?? 2),
    dailyPnl: value?.dailyPnl ?? 0,
    dailyLoss: value?.dailyLoss ?? "0",
    tradesToday: value?.tradesToday ?? 0,
    consecutiveStops: value?.consecutiveStops ?? "0",
    plan: Boolean(value?.plan),
    newsChecked: Boolean(value?.newsChecked),
    stopSet: Boolean(value?.stopSet),
    revenge: Boolean(value?.revenge),
    lockUntil: value?.lockUntil ?? "",
    emergencyNote: value?.emergencyNote ?? fallbackEmergencyNote,
    updatedAt: value?.updatedAt ?? "",
  });
}

function normalizeSetups(setups: Setup[] | undefined, defaultSetups = DEFAULT_SETUPS): Setup[] {
  const normalizedSaved = Array.isArray(setups)
    ? setups.map((setup) => ({
        ...setup,
        description: setup.description ?? "",
        defaultInstrument: setup.defaultInstrument ?? "",
        isDefault: Boolean(setup.isDefault),
        isActive: setup.isActive ?? true,
        createdAt: setup.createdAt ?? "2026-01-01T00:00:00.000Z",
        updatedAt: setup.updatedAt ?? setup.createdAt ?? "2026-01-01T00:00:00.000Z",
      }))
    : [];
  const byId = new Map<string, Setup>(normalizedSaved.map((setup) => [setup.id, setup]));

  for (const defaultSetup of defaultSetups) {
    const saved = byId.get(defaultSetup.id);
    byId.set(defaultSetup.id, saved ? { ...defaultSetup, ...saved, isDefault: true } : defaultSetup);
  }

  return [...byId.values()];
}

function normalizeSessionPlans(plans: SessionPlan[] | undefined, fallbackDate: string, setups: Setup[]): SessionPlan[] {
  if (!Array.isArray(plans)) return [];

  return plans.map((plan, index) => ({
    ...createSessionPlan(plan.planDate ?? fallbackDate, plan.symbol || "BCOUSD", plan.id ?? Date.now() + index),
    ...plan,
    carryCount: Number(plan.carryCount) || 0,
    setupId: plan.setupId || "oil-impulse-retest",
    setupName: plan.setupName || setups.find((setup) => setup.id === plan.setupId)?.name || DEFAULT_SETUPS.find((setup) => setup.id === plan.setupId)?.name || "Импульс по нефти + ретест",
    planDate: plan.planDate ?? fallbackDate,
    symbol: plan.symbol || "BCOUSD",
  }));
}

function normalizeArchivedPlans(plans: ArchivedPlan[] | undefined, fallbackDate: string, setups: Setup[]): ArchivedPlan[] {
  if (!Array.isArray(plans)) return [];

  return plans.map((plan, index) => ({
    ...createSessionPlan(plan.planDate ?? fallbackDate, plan.symbol || "BCOUSD", plan.id ?? Date.now() + index),
    ...plan,
    carryCount: Number(plan.carryCount) || 0,
    setupId: plan.setupId || "oil-impulse-retest",
    setupName: plan.setupName || setups.find((setup) => setup.id === plan.setupId)?.name || DEFAULT_SETUPS.find((setup) => setup.id === plan.setupId)?.name || "Импульс по нефти + ретест",
    archivedAt: plan.archivedAt ?? "",
    planDate: plan.planDate ?? fallbackDate,
    symbol: plan.symbol || "BCOUSD",
  }));
}

function toCloudPayload(state: PlanningState): CloudPayload {
  return {
    setups: state.setups,
    sessionPlans: state.sessionPlans,
    archivedPlans: state.archivedPlans,
    instrumentImages: state.instrumentImages,
    marketIdeaNotes: state.marketIdeaNotes,
    dailyRiskBudgets: state.dailyRiskBudgets,
    riskControlsByDate: state.riskControlsByDate,
    accountSettings: state.accountSettings,
    emergencyNotes: state.emergencyNotes,
    emergencyLock: state.emergencyLock,
    activePlanDate: state.activePlanDate,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}
