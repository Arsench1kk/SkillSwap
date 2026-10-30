import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import {
  accountParticipants,
  learnerRequests,
} from "@/db/schema";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import {
  contactIsValid,
  learnerRequestInputSchema,
  submitLearnerRequest,
} from "@/domain/learner-request-submission";

async function getLearnerSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "unauthorized" as const };
  if (session.user.activeRole !== "learner")
    return { error: "learner_role_required" as const };
  return { userId: session.user.id };
}

export async function GET() {
  try {
    const session = await getLearnerSession();
    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.error === "unauthorized" ? 401 : 403 },
      );
    }

    const [participant] = await db
      .select({ participantId: accountParticipants.participantId })
      .from(accountParticipants)
      .where(
        and(
          eq(accountParticipants.authUserId, session.userId),
          eq(accountParticipants.role, "learner"),
        ),
      )
      .limit(1);
    if (!participant)
      return NextResponse.json({ requests: [] }, { status: 200 });

    const requests = await db
      .select({
        id: learnerRequests.id,
        taskDescription: learnerRequests.taskDescription,
        taskCategory: learnerRequests.taskCategory,
        status: learnerRequests.status,
        deadlineAt: learnerRequests.deadlineAt,
        createdAt: learnerRequests.createdAt,
      })
      .from(learnerRequests)
      .where(eq(learnerRequests.participantId, participant.participantId))
      .orderBy(desc(learnerRequests.createdAt));

    return NextResponse.json({ requests }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "requests_unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getLearnerSession();
    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.error === "unauthorized" ? 401 : 403 },
      );
    }

    if (
      !(await allowRateLimitedAttempt(
        db,
        "learner-request-account",
        session.userId,
        10,
      ))
    ) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const parsed = learnerRequestInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    if (!contactIsValid(parsed.data.contactType, parsed.data.contact))
      return NextResponse.json({ error: "invalid_contact" }, { status: 400 });

    const result = await submitLearnerRequest(parsed.data, {
      authUserId: session.userId,
    });
    if (result.status === "ineligible")
      return NextResponse.json(
        { status: result.status, reason: result.reason, requestId: result.requestId },
        { status: 200 },
      );

    return NextResponse.json(
      { status: result.status, requestId: result.requestId },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (
      error instanceof Error &&
      ["invalid_deadline", "invalid_contact", "invalid_time_window"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "request_unavailable" },
      { status: 503 },
    );
  }
}
