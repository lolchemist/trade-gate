import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_SETUPS, STORAGE_KEY } from "./constants";
import { createSessionPlan, getInitialPlanDate } from "./utils";
import type { ArchivedPlan, CloudPayload, PlanningState, SessionPlan, Setup, StorageLoadResult, StorageSaveResult } from "./types";

type CloudStateRow = {
  data: unknown;
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
    async loadInitial(defaultState: PlanningState): Promise<StorageLoadResult> {
      const localResult = readLocalState(defaultState);
      const localState = localResult.state;
      const syncKey = localState.syncKey || defaultState.syncKey;

      if (supabase) {
        const cloudResult = await loadFromSupabase(supabase, syncKey, defaultState);
        if (cloudResult) {
          writeLocalState(cloudResult.state);
          return cloudResult;
        }
      }

      if (localResult.found) {
        return {
          state: localState,
          source: "localStorage",
          message: supabase ? "Данные Supabase недоступны, загружена локальная копия" : "Supabase не настроен, загружена локальная копия",
        };
      }

      return {
        state: defaultState,
        source: "default",
        message: supabase ? "В Supabase и локальной копии пока нет данных" : "Supabase не настроен, используется стартовое состояние",
      };
    },
    async load(syncKey: string, defaultState: PlanningState): Promise<StorageLoadResult> {
      if (supabase) {
        const cloudResult = await loadFromSupabase(supabase, syncKey, defaultState);
        if (cloudResult) {
          writeLocalState(cloudResult.state);
          return cloudResult;
        }
      }

      const localResult = readLocalState({ ...defaultState, syncKey });
      return {
        state: localResult.state,
        source: localResult.found ? "localStorage" : "default",
        message: localResult.found
          ? supabase
            ? "В Supabase нет данных по этому ключу, загружена локальная копия"
            : "Supabase не настроен, загружена локальная копия"
          : supabase
            ? "В Supabase и локальной копии пока нет данных по этому ключу"
            : "Supabase не настроен, локальной копии пока нет",
      };
    },
    async save(state: PlanningState): Promise<StorageSaveResult> {
      const normalizedState = normalizePlanningState(state);

      if (supabase) {
        const { error } = await supabase.from(TABLE_NAME).upsert(
          {
            user_key: normalizedState.syncKey,
            data: toCloudPayload(normalizedState),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_key" }
        );

        if (!error) {
          writeLocalState(normalizedState);
          return {
            source: "supabase",
            message: "Сохранено в Supabase, локальная копия обновлена",
          };
        }

        writeLocalState(normalizedState);
        return {
          source: "localStorage",
          message: `Supabase недоступен: ${error.message}. Сохранено локально`,
        };
      }

      writeLocalState(normalizedState);
      return {
        source: "localStorage",
        message: "Supabase не настроен, сохранено локально",
      };
    },
  };
}

function createSupabaseClient(config: StorageConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function loadFromSupabase(supabase: SupabaseClient, syncKey: string, defaultState: PlanningState): Promise<StorageLoadResult | null> {
  const { data, error } = await supabase.from(TABLE_NAME).select("data").eq("user_key", syncKey).maybeSingle<CloudStateRow>();

  if (error || !data?.data) return null;

  return {
    state: normalizePlanningState({ ...(data.data as Partial<PlanningState>), syncKey }, defaultState),
    source: "supabase",
    message: "Загружено из Supabase",
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
  const setups = normalizeSetups(state.setups, defaultState?.setups);
  const sessionPlans = normalizeSessionPlans(state.sessionPlans, fallbackDate, setups);

  return {
    setups,
    sessionPlans: sessionPlans.length > 0 ? sessionPlans : [createSessionPlan(fallbackDate, "BCOUSD", 1)],
    archivedPlans: normalizeArchivedPlans(state.archivedPlans, fallbackDate, setups),
    instrumentImages: state.instrumentImages ?? defaultState?.instrumentImages ?? {},
    marketIdeaNotes: state.marketIdeaNotes ?? defaultState?.marketIdeaNotes ?? {},
    dailyRiskBudgets: state.dailyRiskBudgets ?? defaultState?.dailyRiskBudgets ?? {},
    accountSettings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(defaultState?.accountSettings ?? {}), ...(state.accountSettings ?? {}) },
    emergencyNotes: state.emergencyNotes ?? defaultState?.emergencyNotes ?? {},
    activePlanDate: state.activePlanDate ?? defaultState?.activePlanDate ?? fallbackDate,
    syncKey: state.syncKey ?? defaultState?.syncKey ?? DEFAULT_SYNC_KEY,
  };
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
    accountSettings: state.accountSettings,
    emergencyNotes: state.emergencyNotes,
    activePlanDate: state.activePlanDate,
  };
}
