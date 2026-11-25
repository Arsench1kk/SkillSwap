import { asc } from "drizzle-orm";
import { db, pool } from "./client";
import { events } from "./schema";
import { z } from "zod";
import { requireActiveOperator } from "@/domain/operator-access";
import { eventsToCsv } from "@/domain/export-events";

async function exportEvents() {
  const [operatorId, ...extra] = process.argv.slice(2);
  if (!process.env.DATABASE_URL || !operatorId || extra.length) {
    throw new Error(
      "Usage: set DATABASE_URL and run npm run db:export-events -- <operator ID>",
    );
  }
  const rows = await db.transaction(async (tx) => {
    await requireActiveOperator(tx, operatorId);
    return tx
      .select({
        eventId: events.eventId,
        participantId: events.participantId,
        role: events.role,
        eventName: events.eventName,
        timestampUtc: events.timestampUtc,
        experiment: events.experiment,
        dataOrigin: events.dataOrigin,
        templateVersion: events.templateVersion,
        briefType: events.briefType,
        taskCategory: events.taskCategory,
        sourceChannel: events.sourceChannel,
        reasonCode: events.reasonCode,
        value: events.value,
        missingReason: events.missingReason,
        actor: events.actor,
        correctsEventId: events.correctsEventId,
        note: events.note,
      })
      .from(events)
      .orderBy(asc(events.timestampUtc), asc(events.eventId));
  });

  process.stdout.write(eventsToCsv(rows));
}

exportEvents()
  .catch((error: unknown) => {
    console.error(
      error instanceof z.ZodError
        ? "Check the operator ID."
        : error instanceof Error &&
            /^(Usage:|Active operator required)/.test(error.message)
          ? error.message
          : "Event export failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
