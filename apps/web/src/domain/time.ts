export type SupportedLocale = "en" | "ru" | "kk";

const almatyLabels: Record<SupportedLocale, string> = {
  en: "Almaty time",
  ru: "время Алматы",
  kk: "Алматы уақыты",
};

export function toUtc(value: Date): Date {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
  return new Date(value.toISOString());
}

export function kazakhstanLocalTimeToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  )
    return null;
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  const candidate = new Date(wallClockUtc);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(candidate);
  const localParts = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const representedAsUtc = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day),
    Number(localParts.hour),
    Number(localParts.minute),
  );
  return new Date(wallClockUtc - (representedAsUtc - wallClockUtc));
}

export function formatKazakhstanTime(
  value: Date,
  locale: SupportedLocale,
): string {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Almaty",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
  return `${formatted} (${almatyLabels[locale]})`;
}

export function toKazakhstanDateTimeInput(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toKazakhstanDateInput(value: Date): string {
  const local = toKazakhstanDateTimeInput(value);
  return local.slice(0, 10);
}
