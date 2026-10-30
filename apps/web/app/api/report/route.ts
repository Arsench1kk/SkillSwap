import { z } from "zod";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { recordEvent, containsContactData } from "@/domain/events";
import { getReportParticipant } from "@/domain/report-page";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { currentDataOrigin } from "@/domain/mentor-brief-page";

const payloadSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    category: z.enum([
      "safety_concern",
      "mentor_conduct",
      "scheduling",
      "privacy_contact",
      "other",
    ]),
    details: z.string().trim().max(1000).nullable(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "invalid_request" }, { status: 400 });
  if (parsed.data.details && containsContactData(parsed.data.details))
    return Response.json({ error: "contact_details" }, { status: 400 });
  try {
    if (
      !(await allowRateLimitedAttempt(
        db,
        "report-action",
        parsed.data.token,
        5,
      ))
    )
      return Response.json({ error: "rate_limited" }, { status: 429 });
    const participant = await getReportParticipant(parsed.data.token);
    if (!participant)
      return Response.json({ error: "link_unavailable" }, { status: 410 });
    await db.transaction(async (tx) => {
      await tx.insert(reports).values({
        participantId: participant.id,
        category: parsed.data.category,
        details: parsed.data.details || null,
      });
      await recordEvent(
        tx,
        { participantId: participant.id, dataOrigin: currentDataOrigin() },
        { eventName: "safety_flag", reasonCode: parsed.data.category },
      );
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "report_unavailable" }, { status: 503 });
  }
}
