import { z } from "zod";

// Pure rules shared by the L1 form (browser) and the submit service (server).
// Keep this file free of database and server-only imports.

export const learnerRequestInputSchema = z
  .object({
    category: z.enum(["STEM", "creative", "other"]),
    task: z.string().trim().min(1).max(3000),
    tried: z.string().trim().min(1).max(2000),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    windows: z
      .array(z.object({ start: z.string().min(1), end: z.string().min(1) }))
      .min(2)
      .max(3),
    giveBack: z.string().trim().max(500),
    contactType: z.enum(["telegram", "phone"]),
    contact: z.string().trim().min(1).max(100),
    consent: z.literal(true),
  })
  .strict();

export type LearnerRequestInput = z.infer<typeof learnerRequestInputSchema>;

export function validDateOnly(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addCalendarDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Calendar date (YYYY-MM-DD) of an instant in Kazakhstan local time. */
export function almatyDate(date: Date): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function contactIsValid(type: "telegram" | "phone", value: string) {
  return type === "telegram"
    ? /^@?[A-Za-z0-9_]{5,32}$/.test(value)
    : /^\+?[\d\s().-]{9,24}$/.test(value) &&
        value.replace(/\D/g, "").length >= 9;
}

/** The L1 rule: a deadline is eligible from today up to 14 calendar days ahead (Kazakhstan date). */
export function deadlineIsEligible(deadline: string, now: Date): boolean {
  if (!validDateOnly(deadline)) return false;
  const today = almatyDate(now);
  return deadline >= today && deadline <= addCalendarDays(today, 14);
}
