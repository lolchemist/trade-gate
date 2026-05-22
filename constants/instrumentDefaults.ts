export type InstrumentDefault = {
  symbol: string;
  pointValuePerLot: number;
  pointValueLabel: string;
};

export const DEFAULT_INSTRUMENT_SYMBOL = "UKOIL.cash";

export const INSTRUMENT_DEFAULTS: Record<string, InstrumentDefault> = {
  "XAUUSD": {
    symbol: "XAUUSD",
    pointValuePerLot: 100,
    pointValueLabel: "$100 / пункт / 1 лот",
  },
  "UKOIL.cash": {
    symbol: "UKOIL.cash",
    pointValuePerLot: 100,
    pointValueLabel: "$100 / пункт / 1 лот",
  },
  "COCOA.c": {
    symbol: "COCOA.c",
    pointValuePerLot: 1,
    pointValueLabel: "$1 / пункт / 1 лот",
  },
};

export const INSTRUMENT_SYMBOL_ALIASES: Record<string, string> = {
  BCOUSD: "UKOIL.cash",
  COCOA: "COCOA.c",
};

export function normalizeInstrumentSymbol(symbol: string) {
  return INSTRUMENT_SYMBOL_ALIASES[symbol] ?? symbol;
}

export function getInstrumentDefault(symbol: string) {
  const normalizedSymbol = normalizeInstrumentSymbol(symbol);
  return INSTRUMENT_DEFAULTS[normalizedSymbol] ?? INSTRUMENT_DEFAULTS[DEFAULT_INSTRUMENT_SYMBOL];
}

export function getPointValuePerLot(symbol: string) {
  return String(getInstrumentDefault(symbol).pointValuePerLot);
}

export function getPointValueLabel(symbol: string) {
  return getInstrumentDefault(symbol).pointValueLabel;
}
