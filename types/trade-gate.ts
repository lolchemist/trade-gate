export type Direction = "long" | "short" | "both";

export type ResultStatus =
  | "not_taken"
  | "no_entry"
  | "take"
  | "stop"
  | "manual_profit"
  | "manual_loss"
  | "breakeven";

export type TechnicalStatus = "yes" | "no" | "partial";

export type GateStatus = "OK" | "CAUTION" | "DANGER" | "LOCKED";

export type TradingDayStatus = "active" | "closed" | "locked";

export type AppStatus = "loading" | "ready" | "syncing" | "error";

export type TradeExecutionType = "trade_1" | "re_entry";

export type TradeExecutionStatus = "planned" | "executed" | ResultStatus;

export type ScenarioLifecycleStatus = "planned" | "active" | "closed" | "archived";

export type EntryType = "bounce" | "breakout" | "false_breakout" | "retest";

export type EditablePlanField = keyof SessionPlan;

export type EditableTradeField = keyof ScenarioTrade;

export type PersistedImages = Record<string, string>;

export type MarketIdeaField = "bias" | "scenario";

export type MarketIdeaNotes = Record<string, string>;

export type CarryScenarioMode = "scenario" | "scenario_image" | "scenario_trade_plan";

export interface SessionPlan {
  id: number;
  planDate: string;
  status: ScenarioLifecycleStatus;
  closedAt?: string;
  archivedAt?: string;
  closeComment?: string;
  chartImage?: string;
  chartImageKey?: string;
  originScenarioId?: number;
  carriedFromDate?: string;
  carryCount: number;
  argumentIds: string[];
  argumentNames: string[];
  arguments: string[];
  /** Legacy field kept for old saved states. New logic uses argumentIds/argumentNames. */
  setupIds: string[];
  /** Legacy field kept for old saved states. New logic uses argumentIds/argumentNames. */
  setupNames: string[];
  /** Legacy field kept for old saved states. New logic uses argumentIds/argumentNames. */
  setupId: string;
  /** Legacy field kept for old saved states. New logic uses argumentIds/argumentNames. */
  setupName: string;
  symbol: string;
  direction: Direction;
  entryZone: string;
  entryMethod: string;
  /** Legacy field kept for saved states from the segmented entry UI. New logic uses entryMethod. */
  entryType?: EntryType;
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
  scenarioInvalidation: string;
  scenarioConfidence: string;
  scenarioQuality: string;
  riskBudgetAllocation: string;
  trades: ScenarioTrade[];
}

export interface ArchivedPlan extends SessionPlan {
  archivedAt: string;
}

export interface ScenarioTrade {
  id: string;
  executionType: TradeExecutionType;
  status: TradeExecutionStatus;
  actualEntry: string;
  actualExit: string;
  actualSize: string;
  actualStop: string;
  actualTake: string;
  actualRisk: string;
  actualResult: string;
  actualRr: string;
  executionNotes: string;
  executedAt: string;
  technical: TechnicalStatus;
  slippage: string;
}

export interface MarketIdea {
  symbol: string;
  title: string;
  bias: string;
  scenario: string;
}

export interface TradeArgument {
  id: string;
  name: string;
  description?: string;
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
  personalMaxRiskPerTrade: string;
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
  bestArgument: string;
  worstArgument: string;
  argumentStats: WeeklyArgumentReport[];
  bestEntryMethod: string;
  worstEntryMethod: string;
  entryMethodStats: WeeklyEntryMethodReport[];
  stopCount: number;
  takeCount: number;
  manualCloseCount: number;
  noEntryCount: number;
  averageArgumentsPerTrade: number;
  bestArgumentCombination: string;
  argumentFrequency: WeeklyScenarioArgumentReport[];
}

export interface WeeklyArgumentReport {
  argumentName: string;
  totalPnl: number;
  tradeCount: number;
  technicalTradePercentage: number;
  averageRr: number;
  winrate: number;
}

export interface WeeklyEntryMethodReport {
  entryMethod: string;
  totalPnl: number;
  tradeCount: number;
  technicalTradePercentage: number;
  winrate: number;
}

export interface WeeklyScenarioArgumentReport {
  argument: string;
  tradeCount: number;
  totalPnl: number;
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
  tradeArguments: TradeArgument[];
  /** Legacy alias kept for existing saved state compatibility. */
  setups: TradeArgument[];
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  tradingDayStatusByDate: Record<string, TradingDayStatus>;
  /** Legacy alias kept for existing saved state compatibility. */
  tradingDayStatuses: Record<string, TradingDayStatus>;
  tradingDayReopenedAtByDate: Record<string, string>;
  riskControlsByDate: Record<string, RiskControlState>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
  emergencyLock: EmergencyLockState;
  activePlanDate: string;
  syncKey: string;
  lastUpdatedAt: string;
}

export interface CloudPayload {
  tradeArguments: TradeArgument[];
  /** Legacy alias kept for existing saved state compatibility. */
  setups: TradeArgument[];
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  dailyRiskBudgets: Record<string, DailyRiskBudget>;
  tradingDayStatusByDate: Record<string, TradingDayStatus>;
  /** Legacy alias kept for existing saved state compatibility. */
  tradingDayStatuses: Record<string, TradingDayStatus>;
  riskControlsByDate: Record<string, RiskControlState>;
  accountSettings: AccountSettings;
  emergencyNotes: Record<string, string>;
  emergencyLock: EmergencyLockState;
  activePlanDate: string;
  lastUpdatedAt: string;
}

export type StorageSource = "supabase" | "localStorage" | "default";

export type SyncStatus = "Loading local data" | "Loading cloud data" | "Saved locally" | "Syncing…" | "Synced" | "Offline / Supabase unavailable" | "Sync error";

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
  argumentCount: number;
  riskValid: boolean;
  rrValid: boolean;
}

export interface QualityScore {
  score: number;
  label: string;
  strengths: string[];
  gaps: string[];
}

export interface ScenarioDiagnostic {
  scenario: SessionPlan;
  ready: boolean;
  validation: ScenarioValidation;
  quality: QualityScore;
  missing: string[];
  fixes: string[];
}

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};
