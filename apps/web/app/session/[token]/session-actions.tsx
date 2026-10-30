"use client";

import { useState } from "react";
import { messages } from "@/messages/en";

export function SessionActions({
  token,
  state,
  meetUrl,
}: {
  token: string;
  state: string;
  meetUrl?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(state === "cancelled");
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action: "cancel" }),
      });
      if (!response.ok) throw new Error("action_failed");
      setCancelled(true);
    } catch {
      setError(messages.sessionActionError);
    } finally {
      setBusy(false);
    }
  }
  if (cancelled)
    return (
      <p className="privacy-review-note" role="status">
        {messages.sessionCancelled}
      </p>
    );
  return (
    <div className="status-actions">
      {meetUrl && (
        <a
          className="public-button session-meet"
          href={meetUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            void fetch("/api/session/action", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token, action: "start" }),
            })
          }
        >
          {messages.sessionOpenMeet}
        </a>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="public-button public-button-secondary"
        type="button"
        disabled={busy}
        onClick={cancel}
      >
        {busy ? messages.requestWorking : messages.sessionCannotAttend}
      </button>
    </div>
  );
}
