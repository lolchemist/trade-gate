import type { FTMOSettings, LocalSessionSettings, TradingSessionStatus } from "@/types/trade-gate";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export type LocalSessionInfo = {
  status: TradingSessionStatus;
  localTradingSessionDate: string;
  isActiveTradingDay: boolean;
  timeUntilOpenMs: number;
  timeUntilCloseMs: number;
  sessionOpenAt: Date;
  sessionCloseAt: Date;
};

export function getCurrentFtmoTime(now: Date, settings: FTMOSettings) {
  return formatZonedDateTime(now, settings.ftmoTimezone);
}

export function getFtmoTradingDay(now: Date, settings: FTMOSettings) {
  const parts = getZonedParts(now, settings.ftmoTimezone);
  const currentDate = toDateISO(parts.year, parts.month, parts.day);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const resetMinutes = parseTimeToMinutes(settings.ftmoResetTime);

  return currentMinutes < resetMinutes ? shiftISODate(currentDate, -1) : currentDate;
}

export function getNextFtmoReset(now: Date, settings: FTMOSettings) {
  const parts = getZonedParts(now, settings.ftmoTimezone);
  const currentDate = toDateISO(parts.year, parts.month, parts.day);
  const todayReset = zonedTimeToUtc(currentDate, settings.ftmoResetTime, settings.ftmoTimezone);
  if (now.getTime() < todayReset.getTime()) return todayReset;
  return zonedTimeToUtc(shiftISODate(currentDate, 1), settings.ftmoResetTime, settings.ftmoTimezone);
}

export function getTimeUntilFtmoReset(now: Date, settings: FTMOSettings) {
  return Math.max(0, getNextFtmoReset(now, settings).getTime() - now.getTime());
}

export function getLocalTimeOfNextFtmoReset(now: Date, ftmoSettings: FTMOSettings, localSettings: LocalSessionSettings) {
  return formatZonedDateTime(getNextFtmoReset(now, ftmoSettings), localSettings.localTimezone);
}

export function getCurrentLocalSession(now: Date, settings: LocalSessionSettings): LocalSessionInfo {
  const parts = getZonedParts(now, settings.localTimezone);
  const localDate = toDateISO(parts.year, parts.month, parts.day);
  const isActiveTradingDay = isTradingWeekday(parts.weekday, settings);
  const sessionOpenAt = zonedTimeToUtc(localDate, settings.localSessionStart, settings.localTimezone);
  const sessionCloseAt = zonedTimeToUtc(localDate, settings.localSessionEnd, settings.localTimezone);
  const nowMs = now.getTime();
  const openMs = sessionOpenAt.getTime();
  const closeMs = sessionCloseAt.getTime();
  let status: TradingSessionStatus = "closed";

  if (!isActiveTradingDay) {
    status = "closed";
  } else if (nowMs < openMs) {
    status = "pre_session";
  } else if (nowMs <= closeMs) {
    status = "active";
  } else {
    status = "post_session";
  }

  return {
    status,
    localTradingSessionDate: localDate,
    isActiveTradingDay,
    timeUntilOpenMs: Math.max(0, openMs - nowMs),
    timeUntilCloseMs: Math.max(0, closeMs - nowMs),
    sessionOpenAt,
    sessionCloseAt,
  };
}

export function getNextValidTradingDate(date: string, settings: LocalSessionSettings) {
  let candidate = shiftISODate(date, 1);
  for (let index = 0; index < 14; index += 1) {
    const weekday = getIsoDateWeekday(candidate);
    if (isTradingWeekday(weekday, settings)) return candidate;
    candidate = shiftISODate(candidate, 1);
  }
  return shiftISODate(date, 1);
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatZonedDateTime(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  return `${toDateISO(parts.year, parts.month, parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function getZonedDate(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  return toDateISO(parts.year, parts.month, parts.day);
}

function isTradingWeekday(weekday: number, settings: LocalSessionSettings) {
  if (settings.skipWeekends && (weekday === 0 || weekday === 6)) return false;
  return settings.activeTradingDays.includes(weekday);
}

function getIsoDateWeekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: normalizeHour(Number(values.hour)),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekdayToNumber(values.weekday),
  };
}

function zonedTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0));
  const offset = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset * 60_000);
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((zonedAsUtc - date.getTime()) / 60_000);
}

function parseTimeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function shiftISODate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function toDateISO(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeHour(hour: number) {
  return hour === 24 ? 0 : hour;
}

function weekdayToNumber(weekday: string | undefined) {
  const key = String(weekday ?? "").slice(0, 3).toLowerCase();
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(key);
}
