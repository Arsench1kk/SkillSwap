"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { messages } from "@/messages/en";
import { Button } from "@/components/ui/primitives";

type Window = { start: string; end: string };
const blankWindow = (): Window => ({ start: "", end: "" });

export function MentorJoinForm() {
  const [windows, setWindows] = useState<Window[]>([
    blankWindow(),
    blankWindow(),
  ]);
  const [contactType, setContactType] = useState<"telegram" | "phone">(
    "telegram",
  );
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const data = {
      displayName: String(form.get("displayName") ?? ""),
      category: String(form.get("category") ?? "STEM"),
      topic: String(form.get("topic") ?? ""),
      proofType: String(form.get("proofType") ?? "link"),
      proofReference: String(form.get("proofReference") ?? ""),
      availability: windows,
      contactType,
      contact: String(form.get("contact") ?? ""),
      consent: form.get("consent") === "on",
    };
    if (
      windows.length < 2 ||
      windows.some((window) => !window.start || !window.end)
    ) {
      setError(messages.mentorWindowRequired);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/mentor/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("join_failed");
      setSubmitted(true);
    } catch {
      setError(messages.mentorSubmitError);
    } finally {
      setBusy(false);
    }
  }

  if (submitted)
    return (
      <section className="request-form" aria-live="polite">
        <h2>{messages.mentorSubmittedTitle}</h2>
        <p>{messages.mentorSubmittedText}</p>
        <Link className="public-text-link" href="/">
          {messages.privacyBack}
        </Link>
      </section>
    );

  return (
    <form className="request-form" onSubmit={onSubmit}>
      <div className="request-field">
        <label htmlFor="mentor-name">{messages.mentorDisplayName}</label>
        <input
          id="mentor-name"
          name="displayName"
          autoComplete="name"
          required
          maxLength={60}
        />
      </div>
      <div className="request-field">
        <label htmlFor="mentor-category">{messages.mentorCategory}</label>
        <select id="mentor-category" name="category">
          <option value="STEM">{messages.requestAreaStem}</option>
          <option value="creative">{messages.requestAreaCreative}</option>
        </select>
      </div>
      <div className="request-field">
        <label htmlFor="mentor-topic">{messages.mentorTopic}</label>
        <input id="mentor-topic" name="topic" required maxLength={120} />
      </div>
      <div className="request-field">
        <label htmlFor="mentor-proof-type">{messages.mentorProofType}</label>
        <select id="mentor-proof-type" name="proofType">
          <option value="link">{messages.mentorProofLink}</option>
          <option value="file_reference">{messages.mentorProofFile}</option>
        </select>
      </div>
      <div className="request-field">
        <label htmlFor="mentor-proof-reference">
          {messages.mentorProofReference}
        </label>
        <input
          id="mentor-proof-reference"
          name="proofReference"
          required
          maxLength={1000}
        />
      </div>

      <fieldset className="request-fieldset">
        <legend>{messages.mentorAvailability}</legend>
        <p className="request-hint">{messages.mentorTimeZone}</p>
        <div className="request-window-list">
          {windows.map((window, index) => (
            <div className="request-window-grid" key={index}>
              <label htmlFor={`mentor-start-${index}`}>
                {messages.requestWindowStart} {index + 1}
              </label>
              <input
                id={`mentor-start-${index}`}
                type="datetime-local"
                value={window.start}
                onChange={(event) =>
                  setWindows((items) =>
                    items.map((item, i) =>
                      i === index
                        ? { ...item, start: event.target.value }
                        : item,
                    ),
                  )
                }
                required
              />
              <label htmlFor={`mentor-end-${index}`}>
                {messages.requestWindowEnd} {index + 1}
              </label>
              <input
                id={`mentor-end-${index}`}
                type="datetime-local"
                value={window.end}
                onChange={(event) =>
                  setWindows((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, end: event.target.value } : item,
                    ),
                  )
                }
                required
              />
            </div>
          ))}
          {windows.length < 3 && (
            <button
              className="request-add-window"
              type="button"
              onClick={() => setWindows((items) => [...items, blankWindow()])}
            >
              {messages.requestAddWindow}
            </button>
          )}
          {windows.length > 2 && (
            <button
              className="request-remove-window"
              type="button"
              onClick={() => setWindows((items) => items.slice(0, 2))}
            >
              {messages.requestRemoveWindow}
            </button>
          )}
        </div>
      </fieldset>

      <div className="request-field">
        <label htmlFor="mentor-contact-type">{messages.mentorContact}</label>
        <select
          id="mentor-contact-type"
          value={contactType}
          onChange={(event) =>
            setContactType(event.target.value as "telegram" | "phone")
          }
        >
          <option value="telegram">{messages.requestContactTelegram}</option>
          <option value="phone">{messages.requestContactPhone}</option>
        </select>
        <label htmlFor="mentor-contact-value">
          {contactType === "telegram"
            ? messages.mentorTelegramInput
            : messages.mentorPhoneInput}
        </label>
        <input
          id="mentor-contact-value"
          name="contact"
          autoComplete="tel"
          required
        />
      </div>
      <p className="request-hint">{messages.mentorVisibility}</p>
      <label className="request-consent">
        <input type="checkbox" name="consent" required />
        <span>{messages.mentorConsent}</span>
      </label>
      <p className="request-hint">
        <Link href="/privacy">{messages.requestPrivacyLink}</Link>
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button className="request-submit" type="submit" disabled={busy}>
        {busy ? messages.requestWorking : messages.mentorSubmit}
      </Button>
    </form>
  );
}
