import type { AccountSettings, MarketIdea, ResultStatus, Setup, TechnicalStatus } from "./types";

export const STORAGE_KEY = "trade-gate-state-v1";

export const LOSS_LIMIT = -1000;

export const DEFAULT_DAILY_RISK_BUDGET = "1000";

export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  accountSize: "100000",
  propDailyLossLimit: "5000",
  personalDailyStop: "1000",
  maxLossLimit: "10000",
  personalMaxLoss: "3000",
  profitTarget: "10000",
};

const DEFAULT_SETUP_DATE = "2026-01-01T00:00:00.000Z";

export const DEFAULT_SETUPS: Setup[] = [
  {
    id: "oil-impulse-retest",
    name: "Импульс по нефти + ретест",
    description: "Вход после импульса и спокойного ретеста ключевого уровня.",
    defaultInstrument: "BCOUSD",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "range-rejection",
    name: "Отбой от границы диапазона",
    description: "Сценарий возврата от верхней или нижней границы диапазона.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "liquidity-sweep",
    name: "Снятие ликвидности",
    description: "Ложный вынос экстремума с возвратом внутрь структуры.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "breakout-retest",
    name: "Пробой + ретест",
    description: "Пробой уровня и подтверждающий ретест без импульсного входа.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "news-spike-fade",
    name: "Затухание новостного импульса",
    description: "Контрольный вход против перегретого новостного движения.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "trend-continuation",
    name: "Продолжение тренда",
    description: "Вход по направлению тренда после коррекции.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
  {
    id: "countertrend-scalp",
    name: "Контртрендовый скальп",
    description: "Короткий контртрендовый сценарий с минимальным риском.",
    defaultInstrument: "",
    isDefault: true,
    isActive: true,
    createdAt: DEFAULT_SETUP_DATE,
    updatedAt: DEFAULT_SETUP_DATE,
  },
];

export const MARKET_IDEAS: MarketIdea[] = [
  {
    symbol: "BCOUSD",
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
    symbol: "COCOA",
    title: "Какао",
    bias: "Высокая волатильность — только минимальный риск",
    scenario: "Интересен пробой после накопления",
  },
];

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  not_taken: "Входа не было",
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
