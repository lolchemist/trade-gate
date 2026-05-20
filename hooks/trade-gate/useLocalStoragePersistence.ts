import { useMemo } from "react";
import { createTradeGateStorage } from "@/components/trade-gate/storage";

export function useLocalStoragePersistence({ supabaseUrl, supabaseAnonKey }: { supabaseUrl?: string; supabaseAnonKey?: string }) {
  return useMemo(() => createTradeGateStorage({ supabaseUrl, supabaseAnonKey }), [supabaseUrl, supabaseAnonKey]);
}
