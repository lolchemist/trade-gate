import { createDefaultFtmoDailyState } from "@/constants/trade-gate";
import type { FTMODailyState, FTMORiskMetrics, FTMOSettings } from "@/types/trade-gate";

export function getFtmoDailyState(states: Record<string, FTMODailyState>, ftmoTradingDay: string, accountSize: string | number) {
  return states[ftmoTradingDay] ?? createDefaultFtmoDailyState(ftmoTradingDay, String(accountSize || 10000));
}

export function calculateFtmoRiskMetrics(settings: FTMOSettings, dailyState: FTMODailyState): FTMORiskMetrics {
  const accountSize = toNumber(settings.accountSize);
  const maxDailyLossAmount = accountSize * (toNumber(settings.maxDailyLossPercent) / 100);
  const maxLossAmount = accountSize * (toNumber(settings.maxLossPercent) / 100);
  const safetyBuffer = toNumber(settings.safetyBuffer);
  const personalDailyStop = toNumber(settings.personalDailyStop);
  const startOfDayEquity = toNumber(dailyState.startOfDayEquity) || accountSize;
  const currentBalance = toNumber(dailyState.currentBalance) || accountSize;
  const currentEquity = toNumber(dailyState.currentEquity) || currentBalance;
  const closedPnlToday = toNumber(dailyState.closedPnlToday);
  const floatingPnl = toNumber(dailyState.floatingPnl);
  const commissions = Math.abs(toNumber(dailyState.commissions));
  const swaps = Math.abs(toNumber(dailyState.swaps));
  const depositsWithdrawalsAdjustment = toNumber(dailyState.depositsWithdrawalsAdjustment);

  const equityChange = currentEquity - startOfDayEquity - depositsWithdrawalsAdjustment;
  const pnlBasedChange = closedPnlToday + floatingPnl - commissions - swaps;
  // Conservative FTMO daily-loss view: take the worse value between equity change and reported PnL,
  // then subtract costs. This prevents optimistic display when open loss or costs are not fully reflected.
  const effectiveDailyLoss = Math.min(equityChange, pnlBasedChange);
  const remainingPersonalDailyRisk = personalDailyStop + effectiveDailyLoss;
  const remainingFtmoDailyRisk = maxDailyLossAmount + effectiveDailyLoss;
  const remainingFtmoDailyRiskAfterBuffer = remainingFtmoDailyRisk - safetyBuffer;
  const maxLossFloor = accountSize - maxLossAmount;
  const distanceToMaxLoss = currentEquity - maxLossFloor;
  const profitTarget = getProfitTarget(settings);
  const currentProfit = currentBalance - accountSize;
  const remainingToTarget = Math.max(0, profitTarget - currentProfit);

  return {
    ftmoTradingDay: dailyState.ftmoTradingDay,
    ftmoMaxDailyLossAmount: maxDailyLossAmount,
    ftmoMaxLossAmount: maxLossAmount,
    profitTarget,
    currentProfit,
    remainingToTarget,
    profitTargetProgress: profitTarget > 0 ? Math.max(0, Math.min(profitTarget, currentProfit)) : 0,
    effectiveDailyLoss,
    effectiveDailyPnl: effectiveDailyLoss,
    remainingPersonalDailyRisk,
    remainingFtmoDailyRisk,
    remainingFtmoDailyRiskAfterBuffer,
    distanceToMaxLoss,
    personalDailyStopUsed: Math.max(0, -effectiveDailyLoss),
    ftmoDailyLossUsed: Math.max(0, -effectiveDailyLoss),
    maxLossBreached: distanceToMaxLoss <= 0,
    personalDailyStopHit: remainingPersonalDailyRisk <= 0,
    ftmoDailyLossHit: remainingFtmoDailyRiskAfterBuffer <= 0,
    nearFtmoDailyLimit: remainingFtmoDailyRiskAfterBuffer <= safetyBuffer * 2,
    safetyBuffer,
  };
}

export function getProfitTarget(settings: FTMOSettings) {
  const accountSize = toNumber(settings.accountSize);
  if (settings.challengePhase === "Phase 1") return accountSize * (toNumber(settings.phase1ProfitTargetPercent) / 100);
  if (settings.challengePhase === "Phase 2") return accountSize * (toNumber(settings.phase2ProfitTargetPercent) / 100);
  return toNumber(settings.fundedProfitTarget);
}

function toNumber(value: string | number | undefined) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}
