import { describe, expect, it } from "vitest";
import { eventsToCsv } from "./export-events";

describe("event CSV export", () => {
  it("uses the data-dictionary event columns and UTC timestamps", () => {
    const csv = eventsToCsv([
      {
        eventId: "11111111-1111-1111-1111-111111111111",
        participantId: "L-0000000001",
        role: "learner",
        eventName: "request_submitted",
        timestampUtc: new Date("2026-10-21T10:07:00.000Z"),
        experiment: "E3",
        dataOrigin: "rehearsal",
        templateVersion: null,
        briefType: null,
        taskCategory: "STEM",
        sourceChannel: "rehearsal_seed",
        reasonCode: null,
        value: null,
        missingReason: null,
        actor: null,
        correctsEventId: null,
        note: "FAKE REHEARSAL DATA ONLY",
      },
    ]);

    expect(csv).toContain("event_id,participant_id,role,event_name");
    expect(csv).toContain("2026-10-21T10:07:00.000Z");
    expect(csv).toContain("rehearsal");
    expect(csv).not.toContain("contact");
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = eventsToCsv([
      {
        eventId: "11111111-1111-1111-1111-111111111111",
        participantId: "L-0000000001",
        role: "learner",
        eventName: "request_updated",
        timestampUtc: new Date("2026-10-21T10:07:00.000Z"),
        experiment: null,
        dataOrigin: "real_pilot",
        templateVersion: null,
        briefType: null,
        taskCategory: null,
        sourceChannel: null,
        reasonCode: null,
        value: null,
        missingReason: null,
        actor: null,
        correctsEventId: null,
        note: 'first, "second"\nthird',
      },
    ]);

    expect(csv).toContain('"first, ""second""\nthird"');
  });

  it("neutralizes spreadsheet formulas in text cells", () => {
    const csv = eventsToCsv([
      {
        eventId: "11111111-1111-1111-1111-111111111111",
        participantId: "L-0000000001",
        role: "learner",
        eventName: "request_updated",
        timestampUtc: new Date("2026-10-21T10:07:00.000Z"),
        experiment: null,
        dataOrigin: "real_pilot",
        templateVersion: null,
        briefType: null,
        taskCategory: null,
        sourceChannel: null,
        reasonCode: null,
        value: null,
        missingReason: null,
        actor: null,
        correctsEventId: null,
        note: ' \t=HYPERLINK("https://example.com")',
      },
    ]);

    expect(csv).toContain(`"' \t=HYPERLINK(""https://example.com"")"`);
  });

  it("leaves missing values blank", () => {
    const csv = eventsToCsv([]);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
