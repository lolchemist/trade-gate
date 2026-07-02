export const EXECUTED_TRADE_STATUSES = new Set(["executed", "take", "stop", "manual_profit", "manual_loss", "breakeven"]);
export const CURRENT_ENTRY_STATUSES = new Set(["filled"]);
export const POTENTIAL_ENTRY_STATUSES = new Set(["filled", "pending"]);

export function calculateDailyRiskUsage({ maxDailyLossUsd, closedPnlUsd, activeRiskUsd }) {
  const maxDailyLoss = positiveNumber(maxDailyLossUsd);
  const closedPnl = finiteNumber(closedPnlUsd);
  const activeRisk = positiveNumber(activeRiskUsd);
  // Profit can repair intraday drawdown, but it must not expand the configured daily risk budget.
  const availableAfterClosedPnl = Math.min(maxDailyLoss, maxDailyLoss + closedPnl);
  const remainingRiskUsd = availableAfterClosedPnl - activeRisk;
  const usedRiskUsd = Math.max(0, maxDailyLoss - remainingRiskUsd);

  return {
    maxDailyLossUsd: maxDailyLoss,
    closedPnlUsd: closedPnl,
    activeRiskUsd: activeRisk,
    remainingRiskUsd,
    usedRiskUsd,
  };
}

export function calculateConsecutiveStopCount(trades) {
  const sorted = [...trades].sort((a, b) => getTradeOrder(a) - getTradeOrder(b) || finiteNumber(a.planId) - finiteNumber(b.planId));
  let count = 0;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index]?.trade?.status !== "stop") break;
    count += 1;
  }

  return count;
}

export function calculateEntryExposure({ entries, legacyEntryPrice, legacyLot, stopPrice, takePrice, pointValuePerLot, includeStatuses = POTENTIAL_ENTRY_STATUSES }) {
  const safeEntries = normalizeEntryParts({ entries, legacyEntryPrice, legacyLot });
  const includedEntries = safeEntries.filter((entry) => includeStatuses.has(entry.status));
  const totalLot = includedEntries.reduce((total, entry) => total + positiveNumber(entry.lot), 0);
  const weightedPrice = includedEntries.reduce((total, entry) => total + finiteNumber(entry.price) * positiveNumber(entry.lot), 0);
  const averageEntry = totalLot > 0 ? weightedPrice / totalLot : 0;
  const stop = finiteNumber(stopPrice);
  const take = finiteNumber(takePrice);
  const pointValue = positiveNumber(pointValuePerLot);
  const stopDistance = totalLot > 0 && stop > 0 ? Math.abs(averageEntry - stop) : 0;
  const takeDistance = totalLot > 0 && take > 0 ? Math.abs(take - averageEntry) : 0;
  const risk = stopDistance > 0 && pointValue > 0 ? stopDistance * pointValue * totalLot : 0;
  const potential = takeDistance > 0 && pointValue > 0 ? takeDistance * pointValue * totalLot : 0;
  const rr = risk > 0 && potential > 0 ? potential / risk : 0;

  return {
    entries: includedEntries,
    lot: totalLot,
    averageEntry,
    stopDistance,
    takeDistance,
    risk,
    potential,
    rr,
    hasData: totalLot > 0 && averageEntry > 0 && stop > 0 && pointValue > 0,
    hasTakeData: totalLot > 0 && averageEntry > 0 && take > 0 && pointValue > 0,
  };
}

export function calculateTradeEntryRisk({ entries, legacyEntryPrice, legacyLot, stopPrice, takePrice, pointValuePerLot }) {
  const current = calculateEntryExposure({
    entries,
    legacyEntryPrice,
    legacyLot,
    stopPrice,
    takePrice,
    pointValuePerLot,
    includeStatuses: CURRENT_ENTRY_STATUSES,
  });
  const potential = calculateEntryExposure({
    entries,
    legacyEntryPrice,
    legacyLot,
    stopPrice,
    takePrice,
    pointValuePerLot,
    includeStatuses: POTENTIAL_ENTRY_STATUSES,
  });
  const pendingEntries = normalizeEntryParts({ entries, legacyEntryPrice, legacyLot }).filter((entry) => entry.status === "pending");

  return {
    current,
    potential,
    pendingEntries,
    hasPendingRisk: potential.risk > current.risk,
  };
}

export function normalizeEntryParts({ entries, legacyEntryPrice, legacyLot }) {
  if (Array.isArray(entries) && entries.length > 0) {
    return entries
      .map((entry, index) => ({
        id: String(entry?.id || `entry-${index}`),
        type: entry?.type === "limit" ? "limit" : "market",
        status: normalizeEntryStatus(entry?.status),
        price: finiteNumber(entry?.price),
        lot: positiveNumber(entry?.lot),
      }))
      .filter((entry) => entry.price > 0 && entry.lot > 0);
  }

  const price = finiteNumber(legacyEntryPrice);
  const lot = positiveNumber(legacyLot);
  if (price <= 0 || lot <= 0) return [];

  return [
    {
      id: "legacy-filled-entry",
      type: "market",
      status: "filled",
      price,
      lot,
    },
  ];
}

function getTradeOrder(item) {
  const rawTimestamp = item?.archivedAt || item?.executedAt || item?.trade?.executedAt || "";
  const timestamp = Date.parse(String(rawTimestamp).replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : finiteNumber(item?.planId);
}

function positiveNumber(value) {
  return Math.max(0, finiteNumber(value));
}

function normalizeEntryStatus(status) {
  if (status === "planned" || status === "pending" || status === "filled" || status === "cancelled") return status;
  return "filled";
}

function finiteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
