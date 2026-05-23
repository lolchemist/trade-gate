import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_TRADE_ARGUMENTS, STORAGE_KEY } from "./constants";
import { createDefaultRiskControls, createScenarioTrade, createSessionPlan, getInitialPlanDate, getInstrumentImageKey, getTradeArgumentNames, isEntryType, mergeTradingDayStatuses, syncLegacyResultFields } from "./utils";
import type { ArchivedPlan, CloudPayload, PlanningState, RiskControlState, ScenarioTrade, SessionPlan, StorageLoadResult, StorageSaveResult, TradeArgument } from "./types";

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
  const tradeArguments = normalizeTradeArguments(state.tradeArguments ?? state.setups, defaultState?.tradeArguments ?? defaultState?.setups);
  const sessionPlans = normalizeSessionPlans(state.sessionPlans, fallbackDate, tradeArguments);
  const emergencyNotes = state.emergencyNotes ?? defaultState?.emergencyNotes ?? {};
  const emergencyLock = state.emergencyLock ?? defaultState?.emergencyLock ?? { revenge: false, lockUntil: "" };
  const riskControlsByDate = normalizeRiskControlsByDate(state.riskControlsByDate, defaultState?.riskControlsByDate, activePlanDate, emergencyNotes, emergencyLock);
  const tradingDayStatuses = normalizeTradingDayStatuses(
    mergeTradingDayStatuses(defaultState?.tradingDayStatuses, defaultState?.tradingDayStatusByDate, state.tradingDayStatuses, state.tradingDayStatusByDate),
    activePlanDate
  );

  return {
    tradeArguments,
    setups: tradeArguments,
    sessionPlans: sessionPlans.length > 0 ? sessionPlans : [createSessionPlan(fallbackDate, DEFAULT_INSTRUMENT_SYMBOL, 1)],
    archivedPlans: normalizeArchivedPlans(state.archivedPlans, fallbackDate, tradeArguments),
    instrumentImages: normalizeInstrumentImages(state.instrumentImages, defaultState?.instrumentImages),
    marketIdeaNotes: state.marketIdeaNotes ?? defaultState?.marketIdeaNotes ?? {},
    dailyRiskBudgets: state.dailyRiskBudgets ?? defaultState?.dailyRiskBudgets ?? {},
    tradingDayStatusByDate: tradingDayStatuses,
    tradingDayStatuses,
    riskControlsByDate,
    accountSettings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(defaultState?.accountSettings ?? {}), ...(state.accountSettings ?? {}) },
    emergencyNotes,
    emergencyLock,
    activePlanDate,
    syncKey: state.syncKey ?? defaultState?.syncKey ?? DEFAULT_SYNC_KEY,
    lastUpdatedAt: state.lastUpdatedAt ?? defaultState?.lastUpdatedAt ?? "",
  };
}

function normalizeTradingDayStatuses(
  statuses: PlanningState["tradingDayStatuses"] | undefined,
  activePlanDate: string
) {
  const merged = { ...(statuses ?? {}) };
  if (!merged[activePlanDate]) merged[activePlanDate] = "active";
  return merged;
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

function normalizeTradeArguments(tradeArguments: TradeArgument[] | undefined, defaultArguments = DEFAULT_TRADE_ARGUMENTS): TradeArgument[] {
  const normalizedSaved = Array.isArray(tradeArguments)
    ? tradeArguments.map((argument) => ({
        ...argument,
        description: argument.description ?? "",
        category: argument.category ?? "",
        tags: Array.isArray(argument.tags) ? argument.tags : [],
        defaultInstrument: argument.defaultInstrument ? normalizeInstrumentSymbol(argument.defaultInstrument) : "",
        isDefault: Boolean(argument.isDefault),
        isActive: argument.isActive ?? true,
        createdAt: argument.createdAt ?? "2026-01-01T00:00:00.000Z",
        updatedAt: argument.updatedAt ?? argument.createdAt ?? "2026-01-01T00:00:00.000Z",
      }))
    : [];
  const byId = new Map<string, TradeArgument>(normalizedSaved.map((argument) => [argument.id, argument]));

  for (const defaultArgument of defaultArguments) {
    const saved = byId.get(defaultArgument.id);
    byId.set(defaultArgument.id, saved ? { ...defaultArgument, ...saved, isDefault: true } : defaultArgument);
  }

  const normalized = [...byId.values()];
  return normalized.length > 0 ? normalized : DEFAULT_TRADE_ARGUMENTS;
}

function normalizeInstrumentImages(images: PlanningState["instrumentImages"] | undefined, defaultImages?: PlanningState["instrumentImages"]) {
  const merged = { ...(defaultImages ?? {}), ...(images ?? {}) };
  const normalized: PlanningState["instrumentImages"] = {};

  for (const [key, value] of Object.entries(merged)) {
    const [date, symbol] = key.split(":");
    if (!date || !symbol) {
      normalized[key] = value;
      continue;
    }

    const normalizedKey = getInstrumentImageKey(date, symbol);
    if (normalizedKey === key || normalized[normalizedKey] === undefined) {
      normalized[normalizedKey] = value;
    }
  }

  return normalized;
}

function normalizeSessionPlans(plans: SessionPlan[] | undefined, fallbackDate: string, tradeArguments: TradeArgument[]): SessionPlan[] {
  if (!Array.isArray(plans)) return [];

  return plans.map((plan, index) => normalizeSessionPlan(plan, fallbackDate, tradeArguments, index));
}

function normalizeArchivedPlans(plans: ArchivedPlan[] | undefined, fallbackDate: string, tradeArguments: TradeArgument[]): ArchivedPlan[] {
  if (!Array.isArray(plans)) return [];

  return plans.map((plan, index) => ({
    ...normalizeSessionPlan(plan, fallbackDate, tradeArguments, index),
    archivedAt: plan.archivedAt ?? "",
  }));
}

function normalizeSessionPlan(plan: SessionPlan, fallbackDate: string, tradeArguments: TradeArgument[], index: number): SessionPlan {
  const symbol = normalizeInstrumentSymbol(plan.symbol || DEFAULT_INSTRUMENT_SYMBOL);
  const fallbackPlan = createSessionPlan(plan.planDate ?? fallbackDate, symbol, plan.id ?? Date.now() + index);
  const legacyPointValue = (plan.symbol === "BCOUSD" || plan.symbol === "COCOA") && (!plan.tradePointValue || plan.tradePointValue === "1000");
  const legacySetup = (plan as SessionPlan & { setup?: string }).setup ?? "";
  const argumentIds = normalizeArgumentIds(plan, legacySetup);
  const argumentNames = normalizeArgumentNames(plan, argumentIds, legacySetup, tradeArguments);
  const normalizedPlan = {
    ...fallbackPlan,
    ...plan,
    status: plan.status ?? ((plan as Partial<ArchivedPlan>).archivedAt ? "archived" : "planned"),
    closedAt: plan.closedAt ?? "",
    archivedAt: (plan as Partial<ArchivedPlan>).archivedAt ?? plan.archivedAt ?? "",
    closeComment: plan.closeComment ?? "",
    chartImage: plan.chartImage ?? "",
    chartImageKey: plan.chartImageKey ?? "",
    carryCount: Number(plan.carryCount) || 0,
    argumentIds,
    argumentNames,
    setupIds: argumentIds,
    setupNames: argumentNames,
    setupId: argumentIds[0] || "",
    setupName: argumentNames[0] || "Аргумент не выбран",
    planDate: plan.planDate ?? fallbackDate,
    symbol,
    entryType: isEntryType(plan.entryType) ? plan.entryType : undefined,
    scenarioInvalidation: plan.scenarioInvalidation ?? "",
    scenarioConfidence: plan.scenarioConfidence ?? "70",
    scenarioQuality: plan.scenarioQuality ?? "",
    riskBudgetAllocation: plan.riskBudgetAllocation ?? plan.tradeRisk ?? "",
    tradePointValue: legacyPointValue ? getPointValuePerLot(symbol) : plan.tradePointValue || getPointValuePerLot(symbol),
    trades: normalizeScenarioTrades(plan, fallbackPlan),
  };

  return syncLegacyResultFields(normalizedPlan);
}

function normalizeScenarioTrades(plan: SessionPlan, fallbackPlan: SessionPlan): ScenarioTrade[] {
  const rawTrades = Array.isArray(plan.trades) ? plan.trades : [];
  const normalizedTrades = rawTrades.map((trade, index) => ({
    ...createScenarioTrade({ ...fallbackPlan, ...plan }, index === 0 ? "trade_1" : "re_entry", trade.id || `legacy-trade-${plan.id}-${index}`),
    ...trade,
    executionType: trade.executionType ?? (index === 0 ? "trade_1" : "re_entry"),
    status: trade.status ?? "planned",
    technical: trade.technical ?? plan.technical ?? "yes",
  }));

  if (normalizedTrades.length > 0) return normalizedTrades;

  if (plan.resultStatus && plan.resultStatus !== "not_taken") {
    const migratedTrade = createScenarioTrade({ ...fallbackPlan, ...plan }, "trade_1", `legacy-trade-${plan.id}`);
    return [
      {
        ...migratedTrade,
        status: plan.resultStatus,
        actualResult: plan.finalResult ?? "",
        actualRr: "",
        executionNotes: plan.archiveComment ?? "",
        executedAt: (plan as Partial<ArchivedPlan>).archivedAt ?? "",
        technical: plan.technical ?? "yes",
      },
    ];
  }

  return [];
}

function normalizeArgumentIds(plan: SessionPlan, legacySetup: string) {
  const argumentIds = Array.isArray(plan.argumentIds) ? plan.argumentIds.map((argumentId) => argumentId.trim()).filter(Boolean) : [];
  if (argumentIds.length > 0) return [...new Set(argumentIds)].slice(0, 5);
  const setupIds = Array.isArray(plan.setupIds) ? plan.setupIds.map((setupId) => setupId.trim()).filter(Boolean) : [];
  if (setupIds.length > 0) return [...new Set(setupIds)].slice(0, 5);
  if (plan.setupId) return [plan.setupId];
  if (legacySetup) return [`legacy-${legacySetup}`];
  return [];
}

function normalizeArgumentNames(plan: SessionPlan, argumentIds: string[], legacySetup: string, tradeArguments: TradeArgument[]) {
  const argumentNames = Array.isArray(plan.argumentNames) ? plan.argumentNames : [];
  const fallbackNames = Array.isArray(plan.setupNames) ? plan.setupNames : [];
  const legacyNames = [...argumentNames, ...fallbackNames, plan.setupName, legacySetup].filter(Boolean);
  return getTradeArgumentNames(tradeArguments, argumentIds, legacyNames).slice(0, 5);
}

function toCloudPayload(state: PlanningState): CloudPayload {
  return {
    tradeArguments: state.tradeArguments,
    setups: state.tradeArguments,
    sessionPlans: state.sessionPlans,
    archivedPlans: state.archivedPlans,
    instrumentImages: state.instrumentImages,
    marketIdeaNotes: state.marketIdeaNotes,
    dailyRiskBudgets: state.dailyRiskBudgets,
    tradingDayStatusByDate: state.tradingDayStatusByDate,
    tradingDayStatuses: state.tradingDayStatuses,
    riskControlsByDate: state.riskControlsByDate,
    accountSettings: state.accountSettings,
    emergencyNotes: state.emergencyNotes,
    emergencyLock: state.emergencyLock,
    activePlanDate: state.activePlanDate,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}
