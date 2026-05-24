import { useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { AppStatus, PlanningState, StorageSaveResult } from "@/types/trade-gate";
import type { PlanningAction } from "./useTradeGateState";

type TradeGateStorage = ReturnType<typeof import("@/components/trade-gate/storage").createTradeGateStorage>;

export function useSupabaseSync({
  storage,
  planning,
  dispatchPlanning,
  initialPlanningState,
}: {
  storage: TradeGateStorage;
  planning: PlanningState;
  dispatchPlanning: Dispatch<PlanningAction>;
  initialPlanningState: PlanningState;
}) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(false);
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [syncStatus, setSyncStatus] = useState("Loading local data");
  const skipNextAutoSaveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(async () => {
      setAppStatus("loading");
      setSyncStatus("Loading local data");
      const localResult = storage.loadLocal(initialPlanningState);
      if (cancelled) return;
      dispatchPlanning({ type: "hydrate", payload: localResult.state });
      setIsHydrated(true);
      setSyncStatus(storage.isCloudConfigured ? "Loading cloud data" : localResult.message);

      try {
        const result = await storage.loadLatest(localResult.state.syncKey, localResult.state, initialPlanningState);
        if (cancelled) return;
        if (result.state.lastUpdatedAt !== localResult.state.lastUpdatedAt || result.source === "supabase") {
          skipNextAutoSaveRef.current = true;
          dispatchPlanning({ type: "hydrate", payload: result.state });
        }
        setSyncStatus(result.message);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to initialize Trade Gate storage", error);
          setSyncStatus("Offline / Supabase unavailable");
        }
      } finally {
        if (!cancelled) {
          setIsCloudLoaded(true);
          setIsInitialSyncComplete(true);
          setAppStatus("ready");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dispatchPlanning, initialPlanningState, storage]);

  useEffect(() => {
    if (!isHydrated || !isInitialSyncComplete) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setAppStatus("syncing");
      setSyncStatus(storage.isCloudConfigured ? "Syncing…" : "Saved locally");
      storage
        .save(planning)
        .then((result) => {
          setSyncStatus(result.status);
          setAppStatus("ready");
          if (result.state.lastUpdatedAt !== planning.lastUpdatedAt) {
            skipNextAutoSaveRef.current = true;
            dispatchPlanning({ type: "hydrate", payload: { lastUpdatedAt: result.state.lastUpdatedAt } });
          }
        })
        .catch((error) => {
          console.error("Failed to auto-save Trade Gate state", error);
          setSyncStatus("Sync error");
          setAppStatus("error");
        });
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [dispatchPlanning, isHydrated, isInitialSyncComplete, planning, storage]);

  const saveNow = async (): Promise<StorageSaveResult | null> => {
    try {
      setAppStatus("syncing");
      setSyncStatus(storage.isCloudConfigured ? "Syncing…" : "Saved locally");
      const result = await storage.save(planning);
      setSyncStatus(result.status);
      setAppStatus("ready");
      if (result.state.lastUpdatedAt !== planning.lastUpdatedAt) {
        skipNextAutoSaveRef.current = true;
        dispatchPlanning({ type: "hydrate", payload: { lastUpdatedAt: result.state.lastUpdatedAt } });
      }
      return result;
    } catch (error) {
      console.error("Failed to save Trade Gate state", error);
      setSyncStatus("Sync error");
      setAppStatus("error");
      return null;
    }
  };

  const loadFromCloud = async (syncKey: string) => {
    try {
      setAppStatus("syncing");
      setSyncStatus(storage.isCloudConfigured ? "Syncing…" : "Offline / Supabase unavailable");
      const result = await storage.load(syncKey, initialPlanningState);
      skipNextAutoSaveRef.current = true;
      dispatchPlanning({ type: "hydrate", payload: result.state });
      setSyncStatus(result.message);
      setIsHydrated(true);
      setIsCloudLoaded(true);
      setIsInitialSyncComplete(true);
      setAppStatus("ready");
    } catch (error) {
      console.error("Failed to load Trade Gate cloud state", error);
      setSyncStatus("Sync error");
      setAppStatus("error");
    }
  };

  return {
    appStatus,
    isHydrated,
    isCloudLoaded,
    isInitialSyncComplete,
    syncStatus,
    setSyncStatus,
    saveNow,
    loadFromCloud,
  };
}
