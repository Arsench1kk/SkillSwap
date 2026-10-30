"use client";

import { useState, type FormEvent } from "react";
import { messages } from "@/messages/en";

const categories = [
  ["safety_concern", messages.reportSafetyConcern],
  ["mentor_conduct", messages.reportMentorConduct],
  ["scheduling", messages.reportScheduling],
  ["privacy_contact", messages.reportPrivacyContact],
  ["other", messages.reportOther],
] as const;

export function ReportForm({
  token,
  responseText,
}: {
  token: string;
  responseText: string;
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          category: form.get("category"),
          details: form.get("details"),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (response.status === 400 && result?.error === "contact_details")
        throw new Error("contact_details");
      if (!response.ok) throw new Error("report_failed");
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message === "contact_details"
          ? messages.reportContactRejected
          : messages.reportError,
      );
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <div className="status-details" role="status">
        <p>{messages.reportThanks}</p>
        <p>{responseText}</p>
      </div>
    );
  return (
    <form className="report-form" onSubmit={submit}>
      <fieldset className="request-fieldset">
        <legend>{messages.reportCategory}</legend>
        <div className="request-choice-list">
          {categories.map(([value, label]) => (
            <label className="request-choice" key={value}>
              <input type="radio" name="category" value={value} required />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="request-field">
        <label htmlFor="report-details">{messages.reportDetails}</label>
        <textarea
          id="report-details"
          name="details"
          maxLength={1000}
          rows={5}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="ui-button ui-button-primary request-submit" disabled={busy}>
        {busy ? messages.requestWorking : messages.reportSubmit}
      </button>
    </form>
  );
}
