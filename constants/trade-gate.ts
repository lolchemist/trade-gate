import type { AccountSettings, EntryType, FTMODailyState, FTMOSettings, LocalSessionSettings, MarketIdea, ResultStatus, TechnicalStatus, TradeArgument } from "@/types/trade-gate";

export const STORAGE_KEY = "trade-gate-state-v1";

export const LOSS_LIMIT = -100;

export const DEFAULT_DAILY_RISK_BUDGET = "100";

export const MIN_SCENARIO_RR = 3;

export const DEFAULT_PERSONAL_MAX_RISK_PER_TRADE = "50";

export const MAX_INSTRUMENT_IMAGE_BYTES = 750_000;

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  bounce: "Отбой",
  breakout: "Пробой",
  false_breakout: "Ложный пробой",
  retest: "Ретест",
};

export const DEFAULT_ENTRY_METHODS = [
  "Отбой",
  "Ретест",
  "Ложный пробой",
  "Пробой",
];

export const DEFAULT_SCENARIO_ARGUMENTS = [
  "Импульс",
  "Ретест",
  "Подтверждение объёмом",
  "Снятие ликвидности",
  "Тренд старшего ТФ",
  "Удержание уровня",
  "Ложный пробой",
  "Дельта подтверждает",
  "Дисбаланс",
  "Поджатие",
  "Вульф",
  "Реакция на новости",
];

export const ENTRY_METHOD_OPTIONS = [
  { value: "", label: "Выбери способ входа" },
  ...DEFAULT_ENTRY_METHODS.map((method) => ({ value: method, label: method })),
];

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  accountSize: "10000",
  propDailyLossLimit: "500",
  personalDailyStop: "100",
  personalMaxRiskPerTrade: DEFAULT_PERSONAL_MAX_RISK_PER_TRADE,
  maxLossLimit: "1000",
  personalMaxLoss: "300",
  profitTarget: "1000",
};

export const DEFAULT_FTMO_SETTINGS: FTMOSettings = {
  accountType: "FTMO 2-Step",
  challengePhase: "Phase 1",
  accountSize: "10000",
  ftmoTimezone: "Europe/Prague",
  ftmoResetTime: "00:00",
  maxDailyLossPercent: "5",
  maxLossPercent: "10",
  phase1ProfitTargetPercent: "10",
  phase2ProfitTargetPercent: "5",
  fundedProfitTarget: "0",
  minimumTradingDays: "0",
  personalDailyStop: "100",
  personalMaxLoss: "300",
  personalMaxRiskPerTrade: DEFAULT_PERSONAL_MAX_RISK_PER_TRADE,
  safetyBuffer: "25",
  bestDayRuleEnabled: false,
  hardBestDayRuleEnforcement: false,
};

export const DEFAULT_LOCAL_SESSION_SETTINGS: LocalSessionSettings = {
  localTimezone: "America/Mexico_City",
  localSessionStart: "07:00",
  localSessionEnd: "15:00",
  activeTradingDays: [1, 2, 3, 4, 5],
  skipWeekends: true,
  allowAfterHoursTrading: false,
};

export function createDefaultFtmoDailyState(ftmoTradingDay: string, accountSize = DEFAULT_FTMO_SETTINGS.accountSize): FTMODailyState {
  return {
    ftmoTradingDay,
    startOfDayBalance: accountSize,
    startOfDayEquity: accountSize,
    currentBalance: accountSize,
    currentEquity: accountSize,
    closedPnlToday: "0",
    floatingPnl: "0",
    commissions: "0",
    swaps: "0",
    depositsWithdrawalsAdjustment: "0",
    updatedAt: "",
  };
}

const DEFAULT_ARGUMENT_DATE = "2026-01-01T00:00:00.000Z";

export const DEFAULT_TRADE_ARGUMENTS: TradeArgument[] = [
  {
    id: "false-breakout-reclaim",
    name: "False breakout reclaim",
    description: "Цена выносит уровень, возвращается обратно и подтверждает, что пробой был ложным.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "liquidity-sweep-htf-level",
    name: "Liquidity sweep at HTF level",
    description: "Снятие ликвидности на старшем уровне с подтверждённым возвратом в структуру.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "compression-breakout-volume",
    name: "Compression breakout with volume",
    description: "Сжатие волатильности перед пробоем, подтверждённое объёмом или импульсом.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "impulse-continuation-reclaim",
    name: "Impulse continuation after reclaim",
    description: "Импульс подтверждает смену контроля, затем рынок удерживает reclaim-зону.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "retest-failed-breakdown",
    name: "Retest after failed breakdown",
    description: "Пробой вниз не получает продолжения, а ретест подтверждает возврат покупателей.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "exhaustion-wick-resistance",
    name: "Exhaustion wick into resistance",
    description: "Вынос в сопротивление с фитилём истощения и слабым продолжением.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "trend-continuation-pullback",
    name: "Trend continuation after pullback",
    description: "Тренд остаётся структурно целым, вход после контролируемого pullback.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "news-overreaction-fade",
    name: "News overreaction fade",
    description: "Новостной импульс выглядит перегретым и теряет продолжение после первого расширения.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "oil-impulse-retest",
    name: "Oil impulse retest",
    description: "Импульс по нефти с контролируемым ретестом зоны, где риск и invalidation заранее понятны.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "range-rejection",
    name: "Range rejection",
    description: "Отбой от границы диапазона с подтверждением, что рынок не принимает цену за уровнем.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "liquidity-sweep",
    name: "Liquidity sweep",
    description: "Сбор ликвидности за уровнем с возвратом и понятной точкой отмены идеи.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "breakout-retest",
    name: "Breakout + retest",
    description: "Пробой уровня получает ретест и удержание, вход строится от подтверждённой зоны.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "news-spike-fade",
    name: "News spike fade",
    description: "Новостной вынос теряет продолжение, а вход опирается на затухание импульса.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "trend-continuation",
    name: "Trend continuation",
    description: "Продолжение действующего тренда после паузы, pullback или reclaim ключевой зоны.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
  {
    id: "countertrend-scalp",
    name: "Countertrend scalp",
    description: "Короткая контртрендовая идея только при ясном уровне, ограниченном риске и быстром invalidation.",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_ARGUMENT_DATE,
    updatedAt: DEFAULT_ARGUMENT_DATE,
  },
];

export const MARKET_IDEAS: MarketIdea[] = [
  {
    symbol: "UKOIL.cash",
    title: "Нефть",
    bias: "Приоритет лонг выше 86 при удержании импульса",
    scenario: "Шорт только если будет агрессивный слив под локальный минимум диапазона",
  },
  {
    symbol: "XAUUSD",
    title: "Золото",
    bias: "Следить за реакцией на новости и удержанием дневного тренда",
    scenario: "Лучше торговать только после подтверждения объёмом",
  },
  {
    symbol: "COCOA.c",
    title: "Какао",
    bias: "Высокая волатильность — только минимальный риск",
    scenario: "Интересен пробой после накопления",
  },
];

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  not_taken: "Входа не было",
  no_entry: "Без входа",
  take: "Тейк",
  stop: "Стоп",
  manual_profit: "Ручное закрытие в плюс",
  manual_loss: "Ручное закрытие в минус",
  breakeven: "Безубыток",
};

export const TECHNICAL_STATUS_LABELS: Record<TechnicalStatus, string> = {
  yes: "Да",
  no: "Нет",
  partial: "Частично",
};
