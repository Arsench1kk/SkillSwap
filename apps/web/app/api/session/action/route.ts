import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, sessions } from "@/db/schema";
import { recordEvent } from "@/domain/events";
import { getSessionPage } from "@/domain/session-page";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { currentDataOrigin } from "@/domain/mentor-brief-page";

const payloadSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    action: z.enum(["start", "cancel"]),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    if (
      !(await allowRateLimitedAttempt(
        db,
        "session-action",
        parsed.data.token,
        10,
      ))
    )
      return Response.json({ error: "rate_limited" }, { status: 429 });
    const page = await getSessionPage(parsed.data.token);
    if (
      page.state !== "ready" ||
      !page.sessionId ||
      !page.matchId ||
      !page.participantId
    )
      return Response.json({ error: "link_unavailable" }, { status: 410 });
    const sessionId = page.sessionId;
    const matchId = page.matchId;
    const participantId = page.participantId;
    const updated = await db.transaction(async (tx) => {
      const [session] = await tx
        .select({ completionState: sessions.completionState })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .for("update")
        .limit(1);
      if (
        !session ||
        !["scheduled", "started"].includes(session.completionState)
      )
        return false;
      if (parsed.data.action === "start") {
        if (session.completionState === "scheduled") {
          await tx
            .update(sessions)
            .set({ completionState: "started" })
            .where(eq(sessions.id, sessionId));
          await recordEvent(
            tx,
            {
              participantId,
              dataOrigin: currentDataOrigin(),
              templateVersion: page.templateVersion,
            },
            { eventName: "session_started" },
          );
        }
      } else {
        await tx
          .update(sessions)
          .set({ completionState: "cancelled" })
          .where(eq(sessions.id, sessionId));
        await tx
          .update(matches)
          .set({ status: "withdrawn" })
          .where(eq(matches.id, matchId));
        await recordEvent(
          tx,
          {
            participantId,
            dataOrigin: currentDataOrigin(),
            templateVersion: page.templateVersion,
          },
          { eventName: "session_cancelled" },
        );
      }
      return true;
    });
    if (!updated)
      return Response.json({ error: "state_changed" }, { status: 409 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "action_unavailable" }, { status: 503 });
  }
}
