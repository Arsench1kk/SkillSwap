import { dataOrigin } from "@/db/schema";

/** Server configuration only. Never copy a participant's request body here. */
export function currentDataOrigin(): (typeof dataOrigin.enumValues)[number] {
  const configured = process.env.SKILLSWAP_DATA_ORIGIN;
  const origin = dataOrigin.enumValues.find((value) => value === configured);
  if (origin) return origin;
  // Preserve the existing mentor flow's local/rehearsal policy. Cohort-level
  // origin rules remain a product decision; production must be explicit.
  if (process.env.NODE_ENV !== "production") return "rehearsal";
  throw new Error(
    "SKILLSWAP_DATA_ORIGIN must be configured before recording events",
  );
}
