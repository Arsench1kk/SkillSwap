export type ExportableEvent = {
  eventId: string;
  participantId: string;
  role: string;
  eventName: string;
  timestampUtc: Date;
  experiment: string | null;
  dataOrigin: string;
  templateVersion: string | null;
  briefType: string | null;
  taskCategory: string | null;
  sourceChannel: string | null;
  reasonCode: string | null;
  value: number | null;
  missingReason: string | null;
  actor: string | null;
  correctsEventId: string | null;
  note: string | null;
};

const columns = [
  "event_id",
  "participant_id",
  "role",
  "event_name",
  "timestamp_utc",
  "experiment",
  "data_origin",
  "template_version",
  "brief_type",
  "task_category",
  "source_channel",
  "reason_code",
  "value",
  "missing_reason",
  "actor",
  "corrects_event_id",
  "note",
] as const;

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (
    typeof value === "string" &&
    (/^[\t\r\n]/.test(text) || /^[\u0000-\u0020]*[=+\-@]/.test(text))
  ) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventsToCsv(rows: readonly ExportableEvent[]): string {
  const body = rows.map((row) =>
    [
      row.eventId,
      row.participantId,
      row.role,
      row.eventName,
      row.timestampUtc.toISOString(),
      row.experiment,
      row.dataOrigin,
      row.templateVersion,
      row.briefType,
      row.taskCategory,
      row.sourceChannel,
      row.reasonCode,
      row.value,
      row.missingReason,
      row.actor,
      row.correctsEventId,
      row.note,
    ]
      .map(csvCell)
      .join(","),
  );
  return [columns.join(","), ...body].join("\r\n") + "\r\n";
}
