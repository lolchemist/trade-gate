import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_INSTRUMENT_SYMBOL, getPointValuePerLot, normalizeInstrumentSymbol } from "@/constants/instrumentDefaults";
import { persistNormalizedTradeGateState } from "@/lib/trade-gate-db/normalized-sync";
import { DEFAULT_ACCOUNT_SETTINGS, DEFAULT_TRADE_ARGUMENTS, STORAGE_KEY } from "./constants";
import { createDefaultRiskControls, createScenarioTrade, createSessionPlan, dedupeTextList, getInitialPlanDate, getInstrumentImageKey, getPlanEntryMethod, getTradeArgumentNames, mergeTradingDayStatuses, normalizeScenarioArguments, syncLegacyResultFields } from "./utils";
import type { ArchivedPlan, CloudPayload, PlanningState, RiskControlState, ScenarioTrade, SessionPlan, StorageLoadResult, StorageSaveResult, TradeArgument } from "./types";

type CloudStateRow = {
  data: unknown;
  updated_at: string | null;
};

type CloudTimestampRow = {
  updated_at: string | null;
};

type StateFootprint = {
  score: number;
  meaningfulSessionPlans: number;
  archivedPlans: number;
  trades: number;
  images: number;
  notes: number;
  riskControls: number;
  dailyRiskBudgets: number;
  closedOrLockedDays: number;
};

type StorageConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const TABLE_NAME = "trade_gate_state";
const DEFAULT_SYNC_KEY = "nataliia-main";
const LOCAL_BACKUP_KEY = `${STORAGE_KEY}:backup`;
const LOCAL_BACKUP_CREATED_AT_KEY = `${STORAGE_KEY}:backup-created-at`;

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

      const cloudPreference = getCloudLoadPreference(currentState, cloudResult.state);

      if (cloudPreference.useCloud) {
        writeLocalState(cloudResult.state);
        return cloudResult;
      }

      if (cloudPreference.message) {
        return {
          state: currentState,
          source: "localStorage",
          message: cloudPreference.message,
        };
      }

      return {
        state: currentState,
        source: "localStorage",
        message: "Saved locally",
      };
    },
    async load(syncKey: string, defaultState: PlanningState): Promise<StorageLoadResult> {
      const localResult = readLocalState({ ...defaultState, syncKey });

      if (supabase) {
        try {
          const cloudResult = await loadFromSupabase(supabase, syncKey, defaultState);
          if (cloudResult) {
            const cloudPreference = getCloudLoadPreference(localResult.state, cloudResult.state);
            if (!cloudPreference.useCloud && cloudPreference.message) {
              return {
                state: localResult.state,
                source: localResult.found ? "localStorage" : "default",
                message: cloudPreference.message,
              };
            }
            writeLocalState(cloudResult.state);
            return cloudResult;
          }
        } catch {
          return {
            state: localResult.state,
            source: "localStorage",
            message: "Offline / Supabase unavailable",
          };
        }
      }

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
        const cloudResult = await loadFromSupabase(supabase, currentState.syncKey, currentState).catch(() => null);
        const conflict = cloudResult
          ? getCloudSaveBlocker(currentState, cloudResult.state)
          : await getCloudConflict(supabase, currentState.syncKey, currentState.lastUpdatedAt);
        if (conflict) {
          if (!isSparseState(getStateFootprint(currentState))) writeLocalState(currentState);
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
          await persistNormalizedTradeGateState(supabase, normalizedState, now);
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

function getCloudLoadPreference(localState: PlanningState, cloudState: PlanningState) {
  const cloudTime = Date.parse(cloudState.lastUpdatedAt || "");
  const localTime = Date.parse(localState.lastUpdatedAt || "");
  const cloudNewer = Number.isFinite(cloudTime) && cloudTime > (Number.isFinite(localTime) ? localTime : 0);
  const localFootprint = getStateFootprint(localState);
  const cloudFootprint = getStateFootprint(cloudState);
  const cloudRicher = isMeaningfullyRicher(cloudFootprint, localFootprint);
  const localRicher = isMeaningfullyRicher(localFootprint, cloudFootprint);

  if ((cloudNewer || cloudRicher) && !localRicher) return { useCloud: true, message: "" };

  if (cloudNewer && localRicher) {
    return {
      useCloud: false,
      message: "Sync error: локальные данные выглядят полнее, чем более свежая облачная запись. Автозагрузка из облака остановлена, чтобы не потерять сценарии.",
    };
  }

  if (isSparseState(localFootprint) && hasMeaningfulTradingData(cloudFootprint)) return { useCloud: true, message: "" };

  return { useCloud: false, message: "" };
}

function getCloudSaveBlocker(localState: PlanningState, cloudState: PlanningState) {
  const cloudTime = Date.parse(cloudState.lastUpdatedAt || "");
  const localTime = Date.parse(localState.lastUpdatedAt || "");
  const cloudNewer = Number.isFinite(cloudTime) && cloudTime > (Number.isFinite(localTime) ? localTime : 0) + 1000;
  const localFootprint = getStateFootprint(localState);
  const cloudFootprint = getStateFootprint(cloudState);
  const localRicher = isMeaningfullyRicher(localFootprint, cloudFootprint);
  const cloudRicher = isMeaningfullyRicher(cloudFootprint, localFootprint);

  if (cloudRicher && !localRicher) {
    return "Sync error: облачная запись содержит больше сценариев/архива, чем текущий локальный снимок. Сохранение в облако остановлено, чтобы не перезаписать данные.";
  }

  if (cloudNewer && !localRicher) {
    return "Sync error: в облаке есть более свежие данные. Загрузите из облака перед сохранением.";
  }

  if (isSparseState(localFootprint) && hasMeaningfulTradingData(cloudFootprint)) {
    return "Sync error: текущий снимок почти пустой, а в облаке есть торговые данные. Сохранение остановлено.";
  }

  return "";
}

function getStateFootprint(state: PlanningState): StateFootprint {
  const sessionPlans = Array.isArray(state.sessionPlans) ? state.sessionPlans : [];
  const archivedPlans = Array.isArray(state.archivedPlans) ? state.archivedPlans : [];
  const allPlans = [...sessionPlans, ...archivedPlans];
  const meaningfulSessionPlans = sessionPlans.filter(isMeaningfulPlan).length;
  const archivedCount = archivedPlans.length;
  const trades = allPlans.reduce((count, plan) => count + (Array.isArray(plan.trades) ? plan.trades.length : 0), 0);
  const images = Object.values(state.instrumentImages ?? {}).filter(Boolean).length + allPlans.filter((plan) => Boolean(plan.chartImage)).length;
  const notes = Object.values(state.marketIdeaNotes ?? {}).filter((note) => typeof note === "string" && note.trim()).length + allPlans.filter(hasPlanNotes).length;
  const riskControls = Object.values(state.riskControlsByDate ?? {}).filter(isMeaningfulRiskControl).length;
  const dailyRiskBudgets = Object.values(state.dailyRiskBudgets ?? {}).filter((budget) => Number(budget?.budgetUsd) > 0).length;
  const closedOrLockedDays = Object.values(state.tradingDayStatuses ?? state.tradingDayStatusByDate ?? {}).filter((status) => status === "closed" || status === "locked").length;
  const score =
    meaningfulSessionPlans * 12 +
    archivedCount * 30 +
    trades * 10 +
    images * 8 +
    notes * 4 +
    riskControls * 3 +
    dailyRiskBudgets * 3 +
    closedOrLockedDays * 6;

  return {
    score,
    meaningfulSessionPlans,
    archivedPlans: archivedCount,
    trades,
    images,
    notes,
    riskControls,
    dailyRiskBudgets,
    closedOrLockedDays,
  };
}

function isMeaningfulPlan(plan: SessionPlan) {
  if (Array.isArray(plan.trades) && plan.trades.length > 0) return true;
  if (plan.status && plan.status !== "planned") return true;
  if (plan.resultStatus && plan.resultStatus !== "not_taken") return true;

  return hasAnyText([
    plan.entryZone,
    plan.entryMethod,
    plan.stop,
    plan.take,
    plan.note,
    plan.finalResult,
    plan.archiveComment,
    plan.tradeEntry,
    plan.tradeRisk,
    plan.scenarioInvalidation,
    plan.scenarioQuality,
    plan.riskBudgetAllocation,
    plan.chartImage,
  ]);
}

function hasPlanNotes(plan: SessionPlan) {
  return hasAnyText([plan.note, plan.archiveComment, plan.closeComment, plan.scenarioInvalidation]);
}

function isMeaningfulRiskControl(control: RiskControlState) {
  return (
    Number(control.dailyPnl) !== 0 ||
    Number(control.dailyLoss) !== 0 ||
    Number(control.tradesToday) !== 0 ||
    Number(control.consecutiveStops) !== 0 ||
    control.plan ||
    control.newsChecked ||
    control.stopSet ||
    control.revenge ||
    Boolean(control.lockUntil) ||
    Boolean(control.emergencyNote?.trim()) ||
    Boolean(control.updatedAt)
  );
}

function hasAnyText(values: unknown[]) {
  return values.some((value) => typeof value === "string" && value.trim().length > 0);
}

function hasMeaningfulTradingData(footprint: StateFootprint) {
  return footprint.archivedPlans > 0 || footprint.meaningfulSessionPlans > 0 || footprint.trades > 0 || footprint.images > 0 || footprint.notes > 0;
}

function isSparseState(footprint: StateFootprint) {
  return footprint.score <= 6 && !hasMeaningfulTradingData(footprint);
}

function isMeaningfullyRicher(candidate: StateFootprint, baseline: StateFootprint) {
  const hasMoreCoreData =
    candidate.archivedPlans > baseline.archivedPlans ||
    candidate.meaningfulSessionPlans > baseline.meaningfulSessionPlans ||
    candidate.trades > baseline.trades ||
    candidate.images > baseline.images;

  return hasMeaningfulTradingData(candidate) && hasMoreCoreData && candidate.score >= baseline.score + 10;
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
    const backupState = readLocalBackupState(defaultState);
    if (!saved) return backupState ? { state: backupState, found: true } : { state: defaultState, found: false };

    const primaryState = normalizePlanningState(JSON.parse(saved) as Partial<PlanningState>, defaultState);
    if (backupState && isMeaningfullyRicher(getStateFootprint(backupState), getStateFootprint(primaryState))) {
      return { state: backupState, found: true };
    }

    return { state: primaryState, found: true };
  } catch (error) {
    console.error("Failed to load saved Trade Gate state", error);
    const backupState = readLocalBackupState(defaultState);
    return backupState ? { state: backupState, found: true } : { state: defaultState, found: false };
  }
}

function readLocalBackupState(defaultState: PlanningState) {
  try {
    const savedBackup = window.localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!savedBackup) return null;
    return normalizePlanningState(JSON.parse(savedBackup) as Partial<PlanningState>, defaultState);
  } catch (error) {
    console.error("Failed to load Trade Gate backup state", error);
    return null;
  }
}

function writeLocalState(state: PlanningState) {
  if (typeof window === "undefined") return;

  try {
    const normalizedState = normalizePlanningState(state);
    const nextSerialized = JSON.stringify(normalizedState);
    backupLocalStateBeforeOverwrite(normalizedState, nextSerialized);
    window.localStorage.setItem(STORAGE_KEY, nextSerialized);
  } catch (error) {
    console.error("Failed to save Trade Gate state", error);
  }
}

function backupLocalStateBeforeOverwrite(nextState: PlanningState, nextSerialized: string) {
  const existingSerialized = window.localStorage.getItem(STORAGE_KEY);
  if (!existingSerialized || existingSerialized === nextSerialized) return;

  try {
    const existingState = normalizePlanningState(JSON.parse(existingSerialized) as Partial<PlanningState>, nextState);
    const existingFootprint = getStateFootprint(existingState);
    const nextFootprint = getStateFootprint(nextState);
    if (!hasMeaningfulTradingData(existingFootprint)) return;

    const existingIsSafer = isMeaningfullyRicher(existingFootprint, nextFootprint) || existingFootprint.score >= nextFootprint.score;
    if (!existingIsSafer) return;

    window.localStorage.setItem(LOCAL_BACKUP_KEY, existingSerialized);
    window.localStorage.setItem(LOCAL_BACKUP_CREATED_AT_KEY, new Date().toISOString());
  } catch (error) {
    console.error("Failed to backup Trade Gate local state", error);
  }
}

function normalizePlanningState(state: Partial<PlanningState>, defaultState?: PlanningState): PlanningState {
  const fallbackDate = defaultState?.activePlanDate ?? getInitialPlanDate();
  const activePlanDate = state.activePlanDate ?? defaultState?.activePlanDate ?? fallbackDate;
  const tradeArguments = normalizeTradeArguments(state.tradeArguments ?? state.setups, defaultState?.tradeArguments ?? defaultState?.setups);
  const sessionPlans = normalizeSessionPlans(state.sessionPlans, fallbackDate, tradeArguments);
  const archivedPlans = normalizeArchivedPlans(state.archivedPlans, fallbackDate, tradeArguments);
  const emergencyNotes = state.emergencyNotes ?? defaultState?.emergencyNotes ?? {};
  const emergencyLock = state.emergencyLock ?? defaultState?.emergencyLock ?? { revenge: false, lockUntil: "" };
  const riskControlsByDate = normalizeRiskControlsByDate(state.riskControlsByDate, defaultState?.riskControlsByDate, activePlanDate, emergencyNotes, emergencyLock);
  const tradingDayReopenedAtByDate = {
    ...(defaultState?.tradingDayReopenedAtByDate ?? {}),
    ...(state.tradingDayReopenedAtByDate ?? {}),
  };
  const tradingDayStatuses = normalizeTradingDayStatuses(
    mergeTradingDayStatuses(defaultState?.tradingDayStatuses, defaultState?.tradingDayStatusByDate, state.tradingDayStatuses, state.tradingDayStatusByDate),
    activePlanDate,
    archivedPlans,
    tradingDayReopenedAtByDate
  );

  return {
    tradeArguments,
    setups: tradeArguments,
    sessionPlans: sessionPlans.length > 0 ? sessionPlans : [createSessionPlan(fallbackDate, DEFAULT_INSTRUMENT_SYMBOL, 1)],
    archivedPlans,
    instrumentImages: normalizeInstrumentImages(state.instrumentImages, defaultState?.instrumentImages),
    marketIdeaNotes: state.marketIdeaNotes ?? defaultState?.marketIdeaNotes ?? {},
    dailyRiskBudgets: state.dailyRiskBudgets ?? defaultState?.dailyRiskBudgets ?? {},
    tradingDayStatusByDate: tradingDayStatuses,
    tradingDayStatuses,
    tradingDayReopenedAtByDate,
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
  activePlanDate: string,
  archivedPlans: ArchivedPlan[],
  reopenedAtByDate: Record<string, string>
) {
  const merged = { ...(statuses ?? {}) };
  const latestArchivedAtByDate = archivedPlans.reduce<Record<string, number>>((dates, plan) => {
    const archivedAt = Date.parse(plan.archivedAt);
    dates[plan.planDate] = Math.max(dates[plan.planDate] ?? 0, Number.isFinite(archivedAt) ? archivedAt : 0);
    return dates;
  }, {});

  for (const plan of archivedPlans) {
    const reopenedAt = Date.parse(reopenedAtByDate[plan.planDate] ?? "");
    const reopenedAfterArchive = Number.isFinite(reopenedAt) && reopenedAt > (latestArchivedAtByDate[plan.planDate] ?? 0);
    if (!reopenedAfterArchive && merged[plan.planDate] !== "locked") merged[plan.planDate] = "closed";
  }

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
    emotionalHistory: normalizeEmotionalHistory(value?.emotionalHistory),
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

function normalizeEmotionalHistory(value: RiskControlState["emotionalHistory"]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      anxiety: Number(item?.anxiety) || 0,
      urge: Number(item?.urge) || 0,
      anger: Number(item?.anger) || 0,
      recordedAt: item?.recordedAt ?? "",
    }))
    .filter((item) => item.recordedAt)
    .slice(-36);
}

function normalizeTradeArguments(tradeArguments: TradeArgument[] | undefined, defaultArguments = DEFAULT_TRADE_ARGUMENTS): TradeArgument[] {
  const source = Array.isArray(tradeArguments) ? tradeArguments : defaultArguments;
  const seenNames = new Set<string>();

  return source.reduce<TradeArgument[]>((argumentsList, argument, index) => {
    const name = argument.name?.trim() ?? "";
    const normalizedName = name.toLowerCase();
    if (!name || seenNames.has(normalizedName)) return argumentsList;
    seenNames.add(normalizedName);

    argumentsList.push({
      id: argument.id || `argument-${index}-${normalizedName.replace(/[^a-z0-9а-яё]+/gi, "-")}`,
      name,
      description: "",
      isDefault: false,
      isActive: true,
      createdAt: argument.createdAt ?? "2026-01-01T00:00:00.000Z",
      updatedAt: argument.updatedAt ?? argument.createdAt ?? "2026-01-01T00:00:00.000Z",
    });

    return argumentsList;
  }, []);
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
  const argumentIds = normalizeArgumentIds(plan, legacySetup, tradeArguments);
  const argumentNames = normalizeArgumentNames(argumentIds, tradeArguments);
  const validArgumentNames = new Set(tradeArguments.map((argument) => argument.name.trim().toLowerCase()));
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
    arguments: normalizeScenarioArguments(plan.arguments).filter((argument) => validArgumentNames.has(argument.toLowerCase())),
    setupIds: argumentIds,
    setupNames: argumentNames,
    setupId: argumentIds[0] || "",
    setupName: argumentNames[0] || "Аргумент не выбран",
    planDate: plan.planDate ?? fallbackDate,
    symbol,
    entryMethod: getPlanEntryMethod(plan),
    entryType: undefined,
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

function normalizeArgumentIds(plan: SessionPlan, legacySetup: string, tradeArguments: TradeArgument[]) {
  const validIds = new Set(tradeArguments.map((argument) => argument.id));
  const byName = new Map(tradeArguments.map((argument) => [argument.name.trim().toLowerCase(), argument.id]));
  const argumentIds = Array.isArray(plan.argumentIds) ? plan.argumentIds.map((argumentId) => argumentId.trim()).filter(Boolean) : [];
  const selectedIds = argumentIds.filter((argumentId) => validIds.has(argumentId));
  if (selectedIds.length > 0) return [...new Set(selectedIds)].slice(0, 5);
  const setupIds = Array.isArray(plan.setupIds) ? plan.setupIds.map((setupId) => setupId.trim()).filter(Boolean) : [];
  const selectedSetupIds = setupIds.filter((setupId) => validIds.has(setupId));
  if (selectedSetupIds.length > 0) return [...new Set(selectedSetupIds)].slice(0, 5);
  const legacyNames = [
    ...(Array.isArray(plan.argumentNames) ? plan.argumentNames : []),
    ...(Array.isArray(plan.setupNames) ? plan.setupNames : []),
    plan.setupName,
    legacySetup,
  ].filter(Boolean);
  return dedupeTextList(legacyNames)
    .map((name) => byName.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id))
    .slice(0, 5);
}

function normalizeArgumentNames(argumentIds: string[], tradeArguments: TradeArgument[]) {
  return dedupeTextList(getTradeArgumentNames(tradeArguments, argumentIds, [])).slice(0, 5);
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
    tradingDayReopenedAtByDate: state.tradingDayReopenedAtByDate,
    riskControlsByDate: state.riskControlsByDate,
    accountSettings: state.accountSettings,
    emergencyNotes: state.emergencyNotes,
    emergencyLock: state.emergencyLock,
    activePlanDate: state.activePlanDate,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}
