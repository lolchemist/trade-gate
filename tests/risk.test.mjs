import test from "node:test";
import assert from "node:assert/strict";
import { calculateConsecutiveStopCount, calculateDailyRiskUsage } from "../lib/trade-gate/risk.js";

test("remaining risk is full budget when no trades exist", () => {
  const result = calculateDailyRiskUsage({
    maxDailyLossUsd: 1000,
    closedPnlUsd: 0,
    activeRiskUsd: 0,
  });

  assert.equal(result.remainingRiskUsd, 1000);
  assert.equal(result.usedRiskUsd, 0);
});

test("remaining risk uses closed PnL and active risk", () => {
  const result = calculateDailyRiskUsage({
    maxDailyLossUsd: 1000,
    closedPnlUsd: -300,
    activeRiskUsd: 200,
  });

  assert.equal(result.remainingRiskUsd, 500);
  assert.equal(result.usedRiskUsd, 500);
});

test("positive closed PnL does not expand risk above daily budget", () => {
  const result = calculateDailyRiskUsage({
    maxDailyLossUsd: 1000,
    closedPnlUsd: 300,
    activeRiskUsd: 200,
  });

  assert.equal(result.remainingRiskUsd, 800);
  assert.equal(result.usedRiskUsd, 200);
});

test("multiple active trades reserve risk", () => {
  const result = calculateDailyRiskUsage({
    maxDailyLossUsd: 1000,
    closedPnlUsd: 0,
    activeRiskUsd: 650,
  });

  assert.equal(result.remainingRiskUsd, 350);
  assert.equal(result.usedRiskUsd, 650);
});

test("consecutive stops are counted from latest facts", () => {
  const trades = [
    fact("take", "2026-06-24T10:00:00.000Z", 1),
    fact("stop", "2026-06-24T11:00:00.000Z", 2),
    fact("stop", "2026-06-24T12:00:00.000Z", 3),
  ];

  assert.equal(calculateConsecutiveStopCount(trades), 2);
});

test("take or breakeven breaks a stop streak", () => {
  const trades = [
    fact("stop", "2026-06-24T10:00:00.000Z", 1),
    fact("take", "2026-06-24T11:00:00.000Z", 2),
    fact("stop", "2026-06-24T12:00:00.000Z", 3),
  ];

  assert.equal(calculateConsecutiveStopCount(trades), 1);
});

test("manual loss does not count as a consecutive stop by default", () => {
  const trades = [
    fact("stop", "2026-06-24T10:00:00.000Z", 1),
    fact("manual_loss", "2026-06-24T11:00:00.000Z", 2),
  ];

  assert.equal(calculateConsecutiveStopCount(trades), 0);
});

function fact(status, executedAt, planId) {
  return {
    planId,
    archivedAt: executedAt,
    trade: {
      status,
      executedAt,
    },
  };
}
