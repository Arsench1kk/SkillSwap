import { z } from "zod";
import { db } from "@/db/client";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { actOnSessionLink } from "@/services/sessions/session-outcomes";

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
    const updated = await actOnSessionLink(
      db,
      parsed.data.token,
      parsed.data.action,
    );
    if (updated === "unavailable")
      return Response.json({ error: "link_unavailable" }, { status: 410 });
    if (updated === "state_changed")
      return Response.json({ error: "state_changed" }, { status: 409 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "action_unavailable" }, { status: 503 });
  }
}
