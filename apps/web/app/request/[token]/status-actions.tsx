"use client";

import { useState } from "react";
import { messages } from "@/messages/en";

type Status =
  | "expired"
  | "waiting"
  | "no_match"
  | "matched"
  | "time_declined"
  | "mentor_withdrew"
  | "session_cancelled"
  | "confirmed"
  | "cancelled"
  | "ineligible";

export function LearnerStatusActions({
  state,
  token,
  deadline,
  windows,
}: {
  state: Status;
  token: string;
  deadline: string;
  windows: { start: string; end: string }[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextDeadline, setNextDeadline] = useState(deadline);
  const [nextWindows, setNextWindows] = useState(windows);
  if (
    ![
      "waiting",
      "no_match",
      "time_declined",
      "mentor_withdrew",
      "matched",
    ].includes(state)
  )
    return null;

  async function submit(action: "cancel" | "confirm" | "decline" | "update") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/request/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          action,
          ...(action === "update"
            ? { deadline: nextDeadline, windows: nextWindows }
            : {}),
        }),
      });
      if (!response.ok) throw new Error("request_failed");
      window.location.reload();
    } catch {
      setError(messages.requestSubmitUnavailable);
      setBusy(false);
    }
  }

  return (
    <div className="status-actions">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {state === "matched" ? (
        <>
          <button
            className="public-button"
            type="button"
            disabled={busy}
            onClick={() => submit("confirm")}
          >
            {busy ? messages.requestWorking : messages.requestConfirmSlot}
          </button>
          <button
            className="public-button public-button-secondary"
            type="button"
            disabled={busy}
            onClick={() => submit("decline")}
          >
            {messages.requestDeclineSlot}
          </button>
        </>
      ) : (
        <>
          {state === "no_match" && (
            <p className="public-copy">{messages.requestKeepWaiting}</p>
          )}
          {["waiting", "time_declined", "mentor_withdrew"].includes(state) && (
            <details className="status-edit">
              <summary>{messages.requestEditTitle}</summary>
              <div className="request-field">
                <label htmlFor="status-deadline">
                  {messages.requestDeadlineLabel}
                </label>
                <input
                  id="status-deadline"
                  type="date"
                  value={nextDeadline}
                  onChange={(event) => setNextDeadline(event.target.value)}
                  required
                />
              </div>
              {nextWindows.map((window, index) => (
                <div className="request-window-grid" key={index}>
                  <label htmlFor={`status-start-${index}`}>
                    {messages.requestWindowStart} {index + 1}
                  </label>
                  <input
                    id={`status-start-${index}`}
                    type="datetime-local"
                    value={window.start}
                    onChange={(event) =>
                      setNextWindows((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, start: event.target.value }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                  <label htmlFor={`status-end-${index}`}>
                    {messages.requestWindowEnd} {index + 1}
                  </label>
                  <input
                    id={`status-end-${index}`}
                    type="datetime-local"
                    value={window.end}
                    onChange={(event) =>
                      setNextWindows((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, end: event.target.value }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                </div>
              ))}
              <button
                className="public-button public-button-secondary"
                type="button"
                disabled={busy}
                onClick={() => submit("update")}
              >
                {messages.requestSaveChanges}
              </button>
            </details>
          )}
          <button
            className="public-button public-button-secondary"
            type="button"
            disabled={busy}
            onClick={() => submit("cancel")}
          >
            {busy ? messages.requestWorking : messages.requestCancel}
          </button>
        </>
      )}
    </div>
  );
}
