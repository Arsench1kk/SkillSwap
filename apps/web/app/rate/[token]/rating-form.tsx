"use client";

import { useState, type FormEvent } from "react";
import { messages } from "@/messages/en";

function RatingChoices({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number | null;
}) {
  return (
    <fieldset className="rating-fieldset">
      <legend>{label}</legend>
      <div className="rating-choices">
        {[1, 2, 3, 4, 5].map((number) => (
          <label key={number}>
            <input
              type="radio"
              name={name}
              value={number}
              defaultChecked={value === number}
              disabled={value !== null}
            />
            <span>{number}</span>
          </label>
        ))}
      </div>
      <div className="rating-endpoints">
        <span>{messages.ratingNotAtAll}</span>
        <span>{messages.ratingCompletely}</span>
      </div>
    </fieldset>
  );
}

export function RatingForm({
  token,
  initial = { unblocked: null, oneLineOutcome: null, trust: null },
}: {
  token: string;
  initial?: {
    unblocked: number | null;
    oneLineOutcome: string | null;
    trust: number | null;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const unblocked = form.get("unblocked");
    const oneLineOutcome = String(form.get("outcome") ?? "").trim();
    const trust = form.get("trust");
    if (unblocked === null && !oneLineOutcome && trust === null) {
      setError(messages.ratingAtLeastOne);
      return;
    }
    const payload = {
      token,
      ...(unblocked !== null ? { unblocked: Number(unblocked) } : {}),
      ...(oneLineOutcome ? { oneLineOutcome } : {}),
      ...(trust !== null ? { trust: Number(trust) } : {}),
    };
    setBusy(true);
    try {
      const response = await fetch("/api/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("submit_failed");
      window.location.reload();
    } catch {
      setError(messages.ratingError);
      setBusy(false);
    }
  }
  return (
    <form className="rating-form" onSubmit={submit}>
      <RatingChoices
        name="unblocked"
        label={messages.ratingUnblocked}
        value={initial.unblocked}
      />
      <div className="request-field">
        <label htmlFor="rating-outcome">{messages.ratingOutcome}</label>
        <input
          id="rating-outcome"
          name="outcome"
          defaultValue={initial.oneLineOutcome ?? ""}
          readOnly={initial.oneLineOutcome !== null}
          maxLength={280}
        />
      </div>
      <RatingChoices
        name="trust"
        label={messages.ratingTrust}
        value={initial.trust}
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="ui-button ui-button-primary request-submit" disabled={busy}>
        {busy ? messages.requestWorking : messages.ratingSubmit}
      </button>
    </form>
  );
}
