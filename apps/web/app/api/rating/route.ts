import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { feedback, sessions } from "@/db/schema";
import { containsContactData, recordEvent } from "@/domain/events";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { verifyPrivateLink } from "@/domain/private-links";
import { currentDataOrigin } from "@/domain/mentor-brief-page";
import { isRatingWindowOpen } from "@/domain/rating-page";

const payloadSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    unblocked: z.number().int().min(1).max(5).optional(),
    oneLineOutcome: z.string().trim().min(1).max(280).optional(),
    trust: z.number().int().min(1).max(5).optional(),
  })
  .refine(
    (data) =>
      data.unblocked !== undefined ||
      data.oneLineOutcome !== undefined ||
      data.trust !== undefined,
  )
  .strict();

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (
    !parsed.success ||
    (parsed.success &&
      parsed.data.oneLineOutcome !== undefined &&
      containsContactData(parsed.data.oneLineOutcome))
  )
    return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    if (
      !(await allowRateLimitedAttempt(
        db,
        "rating-action",
        parsed.data.token,
        5,
      ))
    )
      return Response.json({ error: "rate_limited" }, { status: 429 });
    const link = await verifyPrivateLink(db, parsed.data.token);
    if (
      link.status !== "valid" ||
      link.purpose !== "rating" ||
      link.subjectType !== "feedback"
    )
      return Response.json({ error: "link_unavailable" }, { status: 410 });
    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: feedback.id,
          participantId: feedback.participantId,
          unblocked: feedback.unblocked,
          oneLineOutcome: feedback.oneLineOutcome,
          trust: feedback.trust,
          templateVersion: sessions.templateVersion,
          endsAt: sessions.endsAt,
        })
        .from(feedback)
        .innerJoin(sessions, eq(sessions.id, feedback.sessionId))
        .where(eq(feedback.id, link.subjectId))
        .for("update")
        .limit(1);
      if (!row) return "unavailable" as const;
      if (!isRatingWindowOpen(row.endsAt)) return "unavailable" as const;
      if (
        row.unblocked !== null &&
        row.oneLineOutcome !== null &&
        row.trust !== null
      )
        return "already_submitted" as const;
      if (
        (parsed.data.unblocked !== undefined && row.unblocked !== null) ||
        (parsed.data.oneLineOutcome !== undefined &&
          row.oneLineOutcome !== null) ||
        (parsed.data.trust !== undefined && row.trust !== null)
      )
        return "already_answered" as const;
      await tx
        .update(feedback)
        .set({
          ...(parsed.data.unblocked !== undefined
            ? {
                unblocked: parsed.data.unblocked,
                unblockedMissingReason: null,
              }
            : {}),
          ...(parsed.data.oneLineOutcome !== undefined
            ? {
                oneLineOutcome: parsed.data.oneLineOutcome,
                outcomeMissingReason: null,
              }
            : {}),
          ...(parsed.data.trust !== undefined
            ? { trust: parsed.data.trust, trustMissingReason: null }
            : {}),
        })
        .where(eq(feedback.id, row.id));
      const eventContext = {
        participantId: row.participantId,
        dataOrigin: currentDataOrigin(),
        templateVersion: row.templateVersion,
      };
      if (parsed.data.unblocked !== undefined)
        await recordEvent(tx, eventContext, {
          eventName: "usefulness_submitted",
          value: parsed.data.unblocked,
        });
      if (parsed.data.trust !== undefined)
        await recordEvent(tx, eventContext, {
          eventName: "trust_submitted",
          value: parsed.data.trust,
        });
      return "submitted" as const;
    });
    if (outcome === "unavailable")
      return Response.json({ error: "link_unavailable" }, { status: 410 });
    if (outcome === "already_submitted")
      return Response.json({ error: "already_submitted" }, { status: 409 });
    if (outcome === "already_answered")
      return Response.json({ error: "already_answered" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const details = error as {
        name?: unknown;
        code?: unknown;
        constraint?: unknown;
      };
      console.error("[rating] submission failed", {
        name: details?.name,
        code: details?.code,
        constraint: details?.constraint,
      });
    }
    return Response.json({ error: "submit_unavailable" }, { status: 503 });
  }
}
