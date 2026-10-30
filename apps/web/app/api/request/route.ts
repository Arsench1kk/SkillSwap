import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import {
  contactIsValid,
  learnerRequestInputSchema,
  submitLearnerRequest,
} from "@/domain/learner-request-submission";

export async function POST(request: Request) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientIp =
    forwardedFor || request.headers.get("x-real-ip") || "unknown";

  try {
    if (
      !(await allowRateLimitedAttempt(db, "learner-request-ip", clientIp, 10))
    ) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const parsed = learnerRequestInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    if (!contactIsValid(parsed.data.contactType, parsed.data.contact)) {
      return NextResponse.json({ error: "invalid_contact" }, { status: 400 });
    }

    const result = await submitLearnerRequest(parsed.data);
    if (result.status === "ineligible")
      return NextResponse.json(
        { status: result.status, reason: result.reason },
        { status: 200 },
      );

    return NextResponse.json(
      { status: result.status, token: result.token },
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
