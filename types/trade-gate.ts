export type Direction = "long" | "short" | "both";

export type ResultStatus =
  | "not_taken"
  | "take"
  | "stop"
  | "manual_profit"
  | "manual_loss"
  | "breakeven";

export type TechnicalStatus = "yes" | "no" | "partial";

export type GateStatus = "OK" | "CAUTION" | "DANGER" | "LOCKED";

export type EditablePlanField = keyof SessionPlan;

export type PersistedImages = Record<string, string>;

export type MarketIdeaField = "bias" | "scenario";

export type MarketIdeaNotes = Record<string, string>;

export type CarryScenarioMode = "scenario" | "scenario_image" | "scenario_trade_plan";

export interface SessionPlan {
  id: number;
  planDate: string;
  originScenarioId?: number;
  carriedFromDate?: string;
  carryCount: number;
  setupId: string;
  setupName: string;
  symbol: string;
  direction: Direction;
  entryZone: string;
  trigger: string;
  stop: string;
  take: string;
  note: string;
  resultStatus: ResultStatus;
  technical: TechnicalStatus;
  finalResult: string;
  archiveComment: string;
  tradeEntry: string;
  tradeStop: string;
  tradeTake: string;
  tradeRisk: string;
  tradePointValue: string;
}

export interface ArchivedPlan extends SessionPlan {
  archivedAt: string;
}

export interface MarketIdea {
  symbol: string;
  title: string;
  bias: string;
  scenario: string;
}

export interface Setup {
  id: string;
  name: string;
  description?: string;
  defaultInstrument?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRiskBudget {
  planDate: string;
  budgetUsd: string;
}

export interface AccountSettings {
  accountSize: string;
  propDailyLossLimit: string;
  personalDailyStop: string;
  maxLossLimit: string;
  personalMaxLoss: string;
  profitTarget: string;
}

export interface RiskControlState {
  sleep: number;
  anxiety: number;
  urge: number;
  anger: number;
  dailyPnl: string | number;
  dailyLoss: string | number;
  tradesToday: string | number;
  consecutiveStops: string | number;
  plan: boolean;
  newsChecked: boolean;
  stopSet: boolean;
  revenge: boolean;
  lockUntil: string;
  emergencyNote?: string;
  updatedAt: string;
}

export type RiskControlField = keyof RiskControlState;

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalPnl: number;
  tradeCount: number;
  technicalTradeCount: number;
  technicalTradePercentage: number;
  bestInstrument: string;
  worstInstrument: string;
  bestSetup: string;
  worstSetup: string;
  setupStats: WeeklySetupReport[];
  stopCount: number;
  takeCount: number;
  manualCloseCount: number;
  noEntryCount: number;
}

export interface WeeklySetupReport {
  setupName: string;
  totalPnl: number;
  tradeCount: number;
  technicalTradePercentage: number;
}

export interface PermissionToTrade {
  permission: "granted" | "reduced" | "denied";
  maxAllowedRisk: number;
  maxAllowedLot: number;
  maxAdditionalTrades: number;
  reEntryAllowed: boolean;
  instruction: string;
}

export interface TodayMetrics {
  planDate: string;
  dailyRiskBudget: DailyRiskBudget;
  activeScenarioCount: number;
  plannedRiskUsed: number;
  realizedPnl: number;
  realizedLossUsed: number;
  riskUsedTotal: number;
  remainingRisk: number;
  dailyPnlForRiskStatus: number;
  dailyLossForRiskStatus: number;
  personalDailyStopHit: boolean;
  propDailyLossClose: boolean;
  propDailyLossHit: boolean;
  propDailyLossUsed: number;
  totalLossUsed: number;
  profitProgress: number;
  tradesToday: number;
  consecutiveStops: number;
  stopCount: number;
  takeCount: number;
  manualCloseCount: number;
  noEntryCount: number;
}

export interface EmergencyLockState {
  revenge: boolean;
  lockUntil: string;
}

export interface PlanningState {
  setups: Setup[];
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  riskControlsByDate: Record<string, RiskControlState>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
  emergencyLock: EmergencyLockState;
  activePlanDate: string;
  syncKey: string;
  lastUpdatedAt: string;
}

export interface CloudPayload {
  setups: Setup[];
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  riskControlsByDate: Record<string, RiskControlState>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
  emergencyLock: EmergencyLockState;
  activePlanDate: string;
  lastUpdatedAt: string;
}

export type StorageSource = "supabase" | "localStorage" | "default";

export type SyncStatus = "Saved locally" | "Syncing…" | "Synced" | "Offline / Supabase unavailable" | "Sync error";

export interface StorageLoadResult {
  state: PlanningState;
  source: StorageSource;
  message: string;
}

export interface StorageSaveResult {
  source: "supabase" | "localStorage";
  message: string;
  state: PlanningState;
  status: SyncStatus;
}

export interface ReadinessScores {
  execution: number;
  emotional: number;
  discipline: number;
}

export interface GateResult {
  status: GateStatus;
  title: string;
  subtitle: string;
  risk: number;
  reasons: string[];
  warnings: string[];
  readiness: ReadinessScores;
  revengeDetectorScore: number;
}

export interface ScenarioTradeMath {
  stopDistance: number;
  takeDistance: number;
  lot: number;
  potential: number;
  rr: number;
  hasData: boolean;
}

export interface ScenarioValidation {
  valid: boolean;
  reasons: string[];
  math: ScenarioTradeMath;
}

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};
