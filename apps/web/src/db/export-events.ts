import { asc } from "drizzle-orm";
import { db, pool } from "./client";
import { events } from "./schema";
import { eventsToCsv } from "@/domain/export-events";

async function exportEvents() {
  const rows = await db
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

  process.stdout.write(eventsToCsv(rows));
}

exportEvents()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Event export failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
