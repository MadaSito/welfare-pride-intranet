export type BirthdayDispatchSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  timeZone: string;
};

export type BirthdayDispatchDate = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function validHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

function validMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 59;
}

export function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function getDefaultBirthdayDispatchSettings(): BirthdayDispatchSettings {
  const configuredHour = Number.parseInt(process.env.BIRTHDAY_DISPATCH_HOUR_UTC || "9", 10);
  const configuredMinute = Number.parseInt(process.env.BIRTHDAY_DISPATCH_MINUTE_UTC || "0", 10);
  const configuredTimeZone = process.env.BIRTHDAY_DISPATCH_TIME_ZONE || "UTC";
  return {
    enabled: true,
    hour: validHour(configuredHour) ? configuredHour : 9,
    minute: validMinute(configuredMinute) ? configuredMinute : 0,
    timeZone: isValidIanaTimeZone(configuredTimeZone) ? configuredTimeZone : "UTC",
  };
}

export function parseBirthdayDispatchSettings(value: unknown): BirthdayDispatchSettings {
  const defaults = getDefaultBirthdayDispatchSettings();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const candidate = value as Partial<BirthdayDispatchSettings>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : defaults.enabled,
    hour: validHour(candidate.hour) ? candidate.hour : defaults.hour,
    minute: validMinute(candidate.minute) ? candidate.minute : defaults.minute,
    timeZone: typeof candidate.timeZone === "string" && isValidIanaTimeZone(candidate.timeZone) ? candidate.timeZone : defaults.timeZone,
  };
}

export function getBirthdayDispatchDate(now: Date, timeZone: string): BirthdayDispatchDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || "0");
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function isBirthdayDispatchDue(now: Date, settings: BirthdayDispatchSettings): boolean {
  if (!settings.enabled) return false;
  const local = getBirthdayDispatchDate(now, settings.timeZone);
  return local.hour === settings.hour && local.minute === settings.minute;
}
