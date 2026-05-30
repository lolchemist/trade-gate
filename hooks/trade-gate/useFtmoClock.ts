import { useEffect, useMemo, useState } from "react";
import {
  formatDuration,
  formatZonedDateTime,
  getCurrentLocalSession,
  getFtmoTradingDay,
  getLocalTimeOfNextFtmoReset,
  getNextFtmoReset,
  getTimeUntilFtmoReset,
} from "@/lib/ftmoTime";
import type { FTMOSettings, LocalSessionSettings } from "@/types/trade-gate";

export function useFtmoClock(ftmoSettings: FTMOSettings, localSessionSettings: LocalSessionSettings, enabled: boolean) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const initialTick = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [enabled]);

  return useMemo(() => {
    if (!now) return null;
    const ftmoTradingDay = getFtmoTradingDay(now, ftmoSettings);
    const nextFtmoReset = getNextFtmoReset(now, ftmoSettings);
    const timeUntilResetMs = getTimeUntilFtmoReset(now, ftmoSettings);
    const localSession = getCurrentLocalSession(now, localSessionSettings);

    return {
      now,
      ftmoTradingDay,
      nextFtmoReset,
      timeUntilResetMs,
      timeUntilReset: formatDuration(timeUntilResetMs),
      isWithinTwoHoursOfReset: timeUntilResetMs <= 2 * 60 * 60 * 1000,
      ftmoTimeLabel: formatZonedDateTime(now, ftmoSettings.ftmoTimezone),
      localTimeLabel: formatZonedDateTime(now, localSessionSettings.localTimezone),
      localResetTimeLabel: getLocalTimeOfNextFtmoReset(now, ftmoSettings, localSessionSettings),
      localSession,
      localTradingSessionDate: localSession.localTradingSessionDate,
      timeUntilSessionOpen: formatDuration(localSession.timeUntilOpenMs),
      timeUntilSessionClose: formatDuration(localSession.timeUntilCloseMs),
    };
  }, [now, ftmoSettings, localSessionSettings]);
}
