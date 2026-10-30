import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import {
  mentorProfiles,
  participantContacts,
  skillEvidence,
} from "@/db/schema";
import { createParticipant } from "@/domain/participants";
import { recordEvent } from "@/domain/events";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { kazakhstanLocalTimeToUtc } from "@/domain/time";

const windowSchema = z
  .object({ start: z.string().min(1), end: z.string().min(1) })
  .strict();
const joinSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    category: z.enum(["STEM", "creative"]),
    topic: z.string().trim().min(2).max(120),
    proofType: z.enum(["link", "file_reference"]),
    proofReference: z.string().trim().min(3).max(1000),
    availability: z.array(windowSchema).min(2).max(3),
    contactType: z.enum(["telegram", "phone"]),
    contact: z.string().trim().min(1).max(100),
    consent: z.literal(true),
  })
  .strict();

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  try {
    if (!(await allowRateLimitedAttempt(db, "mentor-join-ip", ip, 10))) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    const parsed = joinSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const input = parsed.data;
    const contactValid =
      input.contactType === "telegram"
        ? /^@?[A-Za-z0-9_]{5,32}$/.test(input.contact)
        : /^\+?[\d\s().-]{9,24}$/.test(input.contact) &&
          input.contact.replace(/\D/g, "").length >= 9;
    if (!contactValid)
      return NextResponse.json({ error: "invalid_contact" }, { status: 400 });

    const availability = input.availability.map(({ start, end }) => {
      const startUtc = kazakhstanLocalTimeToUtc(start);
      const endUtc = kazakhstanLocalTimeToUtc(end);
      return startUtc && endUtc && startUtc > new Date() && endUtc > startUtc
        ? { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() }
        : null;
    });
    if (availability.some((window) => !window)) {
      return NextResponse.json(
        { error: "invalid_availability" },
        { status: 400 },
      );
    }

    const origin = z
      .enum(["real_pilot", "constructed", "rehearsal"])
      .catch("rehearsal")
      .parse(process.env.SKILLSWAP_DATA_ORIGIN);
    const now = new Date();
    await db.transaction(async (tx) => {
      const participant = await createParticipant(tx, {
        role: "mentor",
        consentGivenAt: now,
      });
      await tx.insert(participantContacts).values({
        participantId: participant.participantId,
        contactType: input.contactType,
        value: input.contact,
      });
      await tx.insert(mentorProfiles).values({
        participantId: participant.participantId,
        displayName: input.displayName,
        availabilityWindows: availability as NonNullable<
          (typeof availability)[number]
        >[],
      });
      await tx.insert(skillEvidence).values({
        mentorParticipantId: participant.participantId,
        category: input.category,
        topic: input.topic,
        proofType: input.proofType,
        proofReference: input.proofReference,
      });
      await recordEvent(
        tx,
        { participantId: participant.participantId, dataOrigin: origin },
        {
          eventName: "mentor_join_submitted",
          sourceChannel: "web",
          taskCategory: input.category,
        },
      );
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "join_unavailable" }, { status: 503 });
  }
}
