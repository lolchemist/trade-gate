import type { MarketIdea, ResultStatus, TechnicalStatus } from "./types";

export const STORAGE_KEY = "trade-gate-state-v1";

export const LOSS_LIMIT = -1000;

export const MARKET_IDEAS: MarketIdea[] = [
  {
    symbol: "BCOUSD",
    title: "Нефть",
    bias: "Приоритет long выше 86 при удержании импульса",
    scenario: "Шорт только если будет агрессивный слив под локальный range low",
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
    scenario: "Интересен breakout после накопления",
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
