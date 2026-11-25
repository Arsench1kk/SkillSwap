import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccountSession } from "@/lib/account-session";
import { db } from "@/db/client";
import { learnerRequests } from "@/db/schema";
import {
  AccountAccessError,
  findAccountParticipant,
} from "@/domain/account-participants";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import {
  contactIsValid,
  learnerRequestInputSchema,
  submitLearnerRequest,
} from "@/domain/learner-request-submission";

function accountRequestAccessError(error: unknown) {
  if (!(error instanceof AccountAccessError)) return null;
  switch (error.code) {
    case "unauthorized":
      return NextResponse.json({ error: error.code }, { status: 401 });
    case "active_role_required":
    case "invalid_account_role":
      return NextResponse.json(
        { error: "learner_role_required" },
        { status: 403 },
      );
    case "participant_withdrawn":
      return NextResponse.json({ error: error.code }, { status: 403 });
    default:
      return null;
  }
}

export async function GET() {
  try {
    const { authUserId } = await requireAccountSession(
      await headers(),
      "learner",
    );
    const requests = await db.transaction(
      async (tx) => {
        const participant = await findAccountParticipant(tx, {
          authUserId,
          role: "learner",
        });
        if (!participant) return [];

        return tx
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
      },
      // The access check and list read must agree on the participant's state.
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );

    return NextResponse.json(
      { requests },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return (
      accountRequestAccessError(error) ??
      NextResponse.json({ error: "requests_unavailable" }, { status: 503 })
    );
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireAccountSession(
      await headers(),
      "learner",
    );

    if (
      !(await allowRateLimitedAttempt(
        db,
        "learner-request-account",
        authUserId,
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
      authUserId,
    });
    if (result.status === "ineligible")
      return NextResponse.json(
        {
          status: result.status,
          reason: result.reason,
          requestId: result.requestId,
        },
        { status: 200 },
      );

    return NextResponse.json(
      { status: result.status, requestId: result.requestId },
      { status: 201 },
    );
  } catch (error) {
    const denied = accountRequestAccessError(error);
    if (denied) return denied;
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
    return NextResponse.json({ error: "request_unavailable" }, { status: 503 });
  }
}
