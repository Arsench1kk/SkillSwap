import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { learnerRequests } from "@/db/schema";
import { verifyPrivateLink } from "@/domain/private-links";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import {
  cancelLearnerRequest,
  confirmLearnerMatch,
  declineLearnerMatch,
  updateLearnerRequest,
  type LearnerActionResult,
} from "@/services/learner/request-actions";

const actionSchema = z
  .object({
    token: z.string().min(1).max(128),
    action: z.enum(["cancel", "confirm", "decline", "update"]),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    windows: z
      .array(
        z.object({ start: z.string().min(1), end: z.string().min(1) }).strict(),
      )
      .min(2)
      .max(3)
      .optional(),
  })
  .strict();

const dataOrigin = z
  .enum(["real_pilot", "constructed", "rehearsal"])
  .catch("rehearsal")
  .parse(process.env.SKILLSWAP_DATA_ORIGIN);

function respond(result: LearnerActionResult) {
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json(
    { error: result.error },
    { status: result.error === "invalid_update" ? 400 : 409 },
  );
}

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    if (
      !(await allowRateLimitedAttempt(
        db,
        "learner-status-action",
        parsed.data.token,
        10,
      ))
    ) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const verified = await verifyPrivateLink(db, parsed.data.token);
    if (
      verified.status !== "valid" ||
      verified.purpose !== "learner_status" ||
      verified.subjectType !== "learner_request"
    ) {
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });
    }
    const [requestRow] = await db
      .select({ id: learnerRequests.id })
      .from(learnerRequests)
      .where(eq(learnerRequests.id, verified.subjectId))
      .limit(1);
    if (!requestRow)
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });

    const context = { requestId: requestRow.id, dataOrigin };
    switch (parsed.data.action) {
      case "update":
        if (!parsed.data.deadline || !parsed.data.windows)
          return NextResponse.json({ error: "state_changed" }, { status: 409 });
        return respond(
          await updateLearnerRequest(
            db,
            {
              deadline: parsed.data.deadline,
              windows: parsed.data.windows,
            },
            context,
          ),
        );
      case "cancel":
        return respond(await cancelLearnerRequest(db, context));
      case "decline":
        return respond(await declineLearnerMatch(db, context));
      case "confirm":
        return respond(await confirmLearnerMatch(db, context));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const details = error as {
        name?: unknown;
        code?: unknown;
        constraint?: unknown;
      };
      console.error("[request-status] action failed", {
        name: details?.name,
        code: details?.code,
        constraint: details?.constraint,
      });
    }
    return NextResponse.json({ error: "action_unavailable" }, { status: 503 });
  }
}
