export const EXECUTED_TRADE_STATUSES = new Set(["executed", "take", "stop", "manual_profit", "manual_loss", "breakeven"]);

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

function getTradeOrder(item) {
  const rawTimestamp = item?.archivedAt || item?.executedAt || item?.trade?.executedAt || "";
  const timestamp = Date.parse(String(rawTimestamp).replace(" ", "T"));
  return Number.isFinite(timestamp) ? timestamp : finiteNumber(item?.planId);
}

function positiveNumber(value) {
  return Math.max(0, finiteNumber(value));
}

function finiteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
