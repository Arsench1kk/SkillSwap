"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "@/messages/en";

type TimeWindowInput = { start: string; end: string };
type Draft = {
  category: string;
  task: string;
  tried: string;
  deadline: string;
  windows: TimeWindowInput[];
  giveBack: string;
  contactType: "telegram" | "phone";
  contact: string;
  consent: boolean;
};

const emptyWindow = (): TimeWindowInput => ({ start: "", end: "" });
const initialDraft: Draft = {
  category: "STEM",
  task: "",
  tried: "",
  deadline: "",
  windows: [emptyWindow(), emptyWindow()],
  giveBack: "",
  contactType: "telegram",
  contact: "",
  consent: false,
};
const DRAFT_KEY = "skillswap-request-draft-v1";

export function RequestForm({
  minDate,
  maxDate,
  mode = "guest",
  onComplete,
}: {
  minDate: string;
  maxDate: string;
  mode?: "guest" | "account";
  onComplete?: () => void;
}) {
  const router = useRouter();
  const deadlineInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info">("info");
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    try {
      const draftKey = mode === "account" ? `${DRAFT_KEY}-account` : DRAFT_KEY;
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Draft>;
        setDraft({ ...initialDraft, ...parsed });
      }
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
    setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const draftKey = mode === "account" ? `${DRAFT_KEY}-account` : DRAFT_KEY;
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // The current form remains usable when browser storage is unavailable.
    }
  }, [draft, hydrated, mode]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function updateWindow(index: number, key: keyof TimeWindowInput, value: string) {
    setDraft((current) => ({
      ...current,
      windows: current.windows.map((window, windowIndex) =>
        windowIndex === index ? { ...window, [key]: value } : window,
      ),
    }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!draft.task.trim()) next.task = t("requestRequired");
    if (!draft.tried.trim()) next.tried = t("requestRequired");
    if (!draft.deadline) next.deadline = t("requestDeadlineRequired");
    draft.windows.forEach((window, index) => {
      if (!window.start || !window.end) {
        next[`window-${index}`] = t("requestWindowRequired");
      } else if (new Date(window.end).getTime() <= new Date(window.start).getTime()) {
        next[`window-${index}`] = t("requestWindowOrder");
      }
    });
    if (!draft.contact.trim()) next.contact = t("requestContactRequired");
    if (!draft.consent) next.consent = t("requestConsentRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!validate()) {
      setMessageTone("error");
      setMessage(t("requestFixErrors"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(
        mode === "account" ? "/api/account/requests" : "/api/request",
        {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
        },
      );
      const result = (await response.json()) as {
        status?: "eligible" | "ineligible";
        token?: string;
        requestId?: string;
        reason?: "deadline" | "category";
      };
      if (!response.ok) throw new Error("request_failed");
      if (result.status === "ineligible") {
        if (mode === "account" && result.requestId) {
          sessionStorage.removeItem(`${DRAFT_KEY}-account`);
          onComplete?.();
        }
        setMessageTone("info");
        setMessage(
          result.reason === "deadline"
            ? t("requestIneligibleDeadline")
            : t("requestIneligibleCategory"),
        );
        return;
      }
      if (mode === "guest") {
        if (!result.token) throw new Error("missing_status_link");
        sessionStorage.removeItem(DRAFT_KEY);
        router.push(`/request/${encodeURIComponent(result.token)}`);
      } else {
        if (!result.requestId) throw new Error("missing_request_id");
        sessionStorage.removeItem(`${DRAFT_KEY}-account`);
        onComplete?.();
      }
    } catch {
      setMessageTone("error");
      setMessage(t("requestNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="request-form" onSubmit={onSubmit} noValidate>
      <fieldset className="request-fieldset">
        <legend>{t("requestAreaLabel")}</legend>
        <div className="request-choice-list">
          {([
            ["STEM", t("requestAreaStem")],
            ["creative", t("requestAreaCreative")],
            ["other", t("requestAreaOther")],
          ] as const).map(([value, label]) => (
            <label className="request-choice" key={value}>
              <input
                type="radio"
                name="category"
                value={value}
                checked={draft.category === value}
                onChange={() => update("category", value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {draft.category === "other" ? (
          <p className="request-hint">{t("requestAreaOtherNote")}</p>
        ) : null}
      </fieldset>

      <div className="request-field">
        <label htmlFor="request-task">{t("requestTaskLabel")}</label>
        <p className="request-hint" id="request-task-hint">
          {t("requestTaskHint")}
        </p>
        <textarea
          id="request-task"
          value={draft.task}
          onChange={(event) => update("task", event.target.value)}
          aria-describedby={`request-task-hint${errors.task ? " request-task-error" : ""}`}
          aria-invalid={Boolean(errors.task)}
          rows={4}
          required
        />
        {errors.task ? <p className="request-error" id="request-task-error">{errors.task}</p> : null}
      </div>

      <div className="request-field">
        <label htmlFor="request-tried">{t("requestTriedLabel")}</label>
        <textarea
          id="request-tried"
          value={draft.tried}
          onChange={(event) => update("tried", event.target.value)}
          aria-invalid={Boolean(errors.tried)}
          aria-describedby={errors.tried ? "request-tried-error" : undefined}
          rows={3}
          required
        />
        {errors.tried ? <p className="request-error" id="request-tried-error">{errors.tried}</p> : null}
      </div>

      <div className="request-field">
        <label htmlFor="request-deadline">{t("requestDeadlineLabel")}</label>
        <p className="request-hint" id="request-deadline-hint">{t("requestDeadlineHint")}</p>
        <div className="request-date-control">
        <input
          ref={deadlineInput}
          id="request-deadline"
          type="date"
          min={minDate}
          max={maxDate}
          value={draft.deadline}
          onChange={(event) => update("deadline", event.target.value)}
          aria-describedby={`request-deadline-hint${maxDate && draft.deadline > maxDate ? " request-deadline-range-error" : ""}${errors.deadline ? " request-deadline-error" : ""}`}
          aria-invalid={Boolean(errors.deadline)}
          required
        />
        <button
          className="request-calendar-button"
          type="button"
          aria-label={t("requestOpenCalendar")}
          onClick={() => {
            if (deadlineInput.current?.showPicker) deadlineInput.current.showPicker();
            else deadlineInput.current?.focus();
          }}
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
        </div>
        {maxDate && draft.deadline && draft.deadline > maxDate ? (
          <p className="request-error" id="request-deadline-range-error" role="status">
            {t("requestIneligibleDeadline")}
          </p>
        ) : null}
        {errors.deadline ? <p className="request-error" id="request-deadline-error">{errors.deadline}</p> : null}
      </div>

      <fieldset className="request-fieldset">
        <legend>{t("requestWindowsLabel")}</legend>
        <p className="request-hint">{t("requestWindowsHint")}</p>
        {draft.windows.map((window, index) => (
          <div className="request-window" key={index}>
            <p className="request-window-title">
              {t("requestWindowNumber").replace("{number}", String(index + 1))}
            </p>
            <div className="request-window-grid">
              <label>
                <span>{t("requestWindowStart")}</span>
                <input
                  type="datetime-local"
                  value={window.start}
                  onChange={(event) => updateWindow(index, "start", event.target.value)}
                  aria-label={`${t("requestWindowStart")} ${index + 1}`}
                />
              </label>
              <label>
                <span>{t("requestWindowEnd")}</span>
                <input
                  type="datetime-local"
                  value={window.end}
                  onChange={(event) => updateWindow(index, "end", event.target.value)}
                  aria-label={`${t("requestWindowEnd")} ${index + 1}`}
                />
              </label>
            </div>
            {errors[`window-${index}`] ? (
              <p className="request-error">{errors[`window-${index}`]}</p>
            ) : null}
            {index === 2 ? (
              <button
                className="request-remove-window"
                type="button"
                onClick={() => setDraft((current) => ({
                  ...current,
                  windows: current.windows.filter((_, windowIndex) => windowIndex !== index),
                }))}
              >
                {t("requestRemoveWindow")}
              </button>
            ) : null}
          </div>
        ))}
        {draft.windows.length < 3 ? (
          <button
            className="request-add-window"
            type="button"
            onClick={() => update("windows", [...draft.windows, emptyWindow()])}
          >
            {t("requestAddWindow")}
          </button>
        ) : null}
      </fieldset>

      <div className="request-field">
        <label htmlFor="request-give-back">{t("requestGiveBackLabel")}</label>
        <p className="request-hint" id="request-give-back-hint">{t("requestGiveBackHint")}</p>
        <input
          id="request-give-back"
          type="text"
          value={draft.giveBack}
          onChange={(event) => update("giveBack", event.target.value)}
          aria-describedby="request-give-back-hint"
        />
      </div>

      <fieldset className="request-fieldset">
        <legend>{t("requestContactLabel")}</legend>
        <div className="request-contact-options">
          <label className="request-choice">
            <input
              type="radio"
              name="contactType"
              checked={draft.contactType === "telegram"}
              onChange={() => update("contactType", "telegram")}
            />
            <span>{t("requestTelegram")}</span>
          </label>
          <label className="request-choice">
            <input
              type="radio"
              name="contactType"
              checked={draft.contactType === "phone"}
              onChange={() => update("contactType", "phone")}
            />
            <span>{t("requestPhone")}</span>
          </label>
        </div>
        <label className="request-contact-value" htmlFor="request-contact">
          {draft.contactType === "telegram" ? t("requestTelegramLabel") : t("requestPhoneLabel")}
        </label>
        <input
          id="request-contact"
          type={draft.contactType === "phone" ? "tel" : "text"}
          autoComplete={draft.contactType === "phone" ? "tel" : "username"}
          value={draft.contact}
          onChange={(event) => update("contact", event.target.value)}
          aria-invalid={Boolean(errors.contact)}
          aria-describedby={errors.contact ? "request-contact-error" : undefined}
          required
        />
        {errors.contact ? <p className="request-error" id="request-contact-error">{errors.contact}</p> : null}
      </fieldset>

      <div className="request-consent-block">
        <label className="request-consent">
          <input
            type="checkbox"
            checked={draft.consent}
            onChange={(event) => update("consent", event.target.checked)}
            aria-invalid={Boolean(errors.consent)}
          />
          <span>{t("requestConsent")}</span>
        </label>
        <p className="request-hint">
          <Link href="/privacy">{t("requestPrivacyLink")}</Link>{" "}
          {t("requestContactPrivacy")}
        </p>
        {errors.consent ? <p className="request-error">{errors.consent}</p> : null}
      </div>

      {message ? (
        <div className="ui-alert" data-tone={messageTone} role="alert">
          {message}
        </div>
      ) : null}
      <button className="ui-button ui-button-primary request-submit" type="submit" disabled={submitting}>
        {submitting ? t("requestSubmitting") : t("requestSubmit")}
      </button>
    </form>
  );
}
