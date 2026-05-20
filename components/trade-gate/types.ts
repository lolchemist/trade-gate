export type Direction = "long" | "short" | "both";

export type TradeDirection = Extract<Direction, "long" | "short">;

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

export interface SessionPlan {
  id: number;
  planDate: string;
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
  entryReason: string;
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

export interface PlanningState {
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  activePlanDate: string;
  syncKey: string;
}

export interface CloudPayload {
  sessionPlans: SessionPlan[];
  archivedPlans: ArchivedPlan[];
  instrumentImages: PersistedImages;
  marketIdeaNotes: MarketIdeaNotes;
  activePlanDate: string;
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

export interface TradeMath {
  stopDistance: number;
  takeDistance: number;
  lots: number;
  rewardDollars: number;
  rr: number;
  stopValid: boolean;
  takeValid: boolean;
  valid: boolean;
}

export interface TradeCalculatorState {
  symbol: string;
  direction: TradeDirection;
  entryReason: string;
  entryPrice: number | string;
  stopPrice: number | string;
  takePrice: number | string;
  riskDollars: number | string;
  dollarsPerPointPerLot: number | string;
}

export type TradeCalculatorField = keyof TradeCalculatorState;

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};
