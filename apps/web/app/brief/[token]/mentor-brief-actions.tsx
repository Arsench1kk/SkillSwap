"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/messages/en";

type Slot = { value: string; label: string };
type Props = {
  token: string;
  state: "unanswered" | "answered" | "declined";
  windows: Slot[];
  proposedSlotInput: string | null;
};

const declineReasons = [
  ["not_my_skill", "briefReasonSkill"],
  ["no_time_before_deadline", "briefReasonTime"],
  ["task_unclear", "briefReasonUnclear"],
  ["unfamiliar_person", "briefReasonUnfamiliar"],
  ["other", "briefReasonOther"],
] as const;

export function MentorBriefActions({
  token,
  state,
  windows,
  proposedSlotInput,
}: Props) {
  const [pending, setPending] = useState(false);
  const storedWindow = state === "answered" ? "" : (windows[0]?.value ?? "");
  const [selectedWindow, setSelectedWindow] = useState(storedWindow);
  const [error, setError] = useState<{
    action: "propose" | "decline";
    message: string;
  } | null>(null);
  const [proposalSent, setProposalSent] = useState(false);
  const [hasProposal, setHasProposal] = useState(state === "answered");
  const [declineSent, setDeclineSent] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [mode, setMode] = useState<"propose" | "decline">("propose");

  async function send(
    event: FormEvent<HTMLFormElement>,
    action: "propose" | "decline",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = {
      token,
      action,
      windowIndex: fields.get("windowIndex"),
      suggestedAt: fields.get("suggestedAt"),
      reasonCode: fields.get("reasonCode"),
      note: fields.get("note"),
    };

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/brief/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError({
          action,
          message: result?.message ?? t("briefActionUnavailable"),
        });
        return;
      }
      if (action === "propose") {
        setHasProposal(true);
        setProposalSent(true);
      }
      else setDeclineSent(true);
    } catch {
      setError({ action, message: t("briefNetworkError") });
    } finally {
      setPending(false);
    }
  }

  async function withdraw() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/brief/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, action: "withdraw" }),
      });
      if (!response.ok) setError({ action: "decline", message: t("briefActionUnavailable") });
      else setWithdrawn(true);
    } catch {
      setError({ action: "decline", message: t("briefNetworkError") });
    } finally {
      setPending(false);
    }
  }

  if (withdrawn) return <p role="status">{t("briefWithdrawn")}</p>;

  if (proposalSent) {
    return (
      <div className="brief-action-result" role="status" aria-live="polite">
        <h3>{t("briefAnsweredTitle")}</h3>
        <p>{t("briefAwaitingLearner")}</p>
        <button className="ui-button ui-button-secondary brief-submit" type="button" onClick={() => setProposalSent(false)}>
          {t("briefChangeTime")}
        </button>
        <button className="ui-button ui-button-secondary brief-submit" type="button" disabled={pending} onClick={withdraw}>
          {t("briefWithdraw")}
        </button>
        {error ? <p className="brief-error" role="alert">{error.message}</p> : null}
      </div>
    );
  }

  if (declineSent) {
    return (
      <div className="brief-action-result" role="status" aria-live="polite">
        <p>{t("briefDeclinedDone")}</p>
        <button className="ui-button ui-button-secondary brief-submit" type="button" onClick={() => { setDeclineSent(false); setMode("propose"); }}>
          {t("briefProposeTime")}
        </button>
      </div>
    );
  }

  return (
    <div className="brief-actions">
      {mode === "propose" ? (
        <>
          <form
            className="brief-action-form"
            onSubmit={(event) => send(event, "propose")}
          >
        <fieldset className="brief-fieldset">
              <legend>{t("briefChooseWindow")}</legend>
              <div className="brief-slot-list">
                {windows.map((window, index) => (
                  <label className="brief-slot" key={window.value}>
                    <input
                      type="radio"
                      name="windowIndex"
                      value={window.value}
                      required={index === 0}
                      checked={selectedWindow === window.value}
                      onChange={() => setSelectedWindow(window.value)}
                      disabled={pending}
                    />
                    <span>{window.label}</span>
                  </label>
                ))}
                <label className="brief-slot brief-slot-other">
                  <input
                    type="radio"
                    name="windowIndex"
                    value="other"
                    checked={selectedWindow === "other"}
                    onChange={() => setSelectedWindow("other")}
                    disabled={pending}
                  />
                  <span>{t("briefSuggestAnother")}</span>
                </label>
              </div>
              {selectedWindow === "other" ? (
                <>
                  <label
                    className="brief-date-label"
                    htmlFor="brief-suggested-time"
                  >
                    {t("briefSuggestedTimeLabel")}
                  </label>
                  <input
                    className="ui-input brief-datetime"
                    id="brief-suggested-time"
                    name="suggestedAt"
                    type="datetime-local"
                    defaultValue={proposedSlotInput ?? undefined}
                    disabled={pending}
                    required
                  />
                </>
              ) : null}
            </fieldset>
            {error?.action === "propose" ? (
              <p className="brief-error" role="alert">
                {error.message}
              </p>
            ) : null}
            <button
              className="ui-button ui-button-primary brief-submit"
              type="submit"
              disabled={pending}
            >
              {pending
                ? t("briefSubmitting")
                : hasProposal
                  ? t("briefChangeTime")
                  : t("briefProposeTime")}
            </button>
          </form>

          {hasProposal ? (
            <button
              className="ui-button ui-button-secondary brief-submit"
              type="button"
              disabled={pending}
              onClick={withdraw}
            >
              {t("briefWithdraw")}
            </button>
          ) : null}
          {error?.action === "decline" ? <p className="brief-error" role="alert">{error.message}</p> : null}

          {state !== "declined" ? <div className="brief-action-form brief-decline-form">
            <button
              className="ui-button ui-button-secondary brief-submit"
              type="button"
              onClick={() => setMode("decline")}
              disabled={pending}
            >
              {t("briefDecline")}
            </button>
          </div> : null}
        </>
      ) : (
        <form
          className="brief-action-form brief-decline-form"
          onSubmit={(event) => send(event, "decline")}
        >
          <fieldset className="brief-fieldset">
            <legend>{t("briefDeclineReasonLabel")}</legend>
            <div className="brief-reason-list">
              {declineReasons.map(([value, key], index) => (
                <label className="brief-reason" key={value}>
                  <input
                    type="radio"
                    name="reasonCode"
                    value={value}
                    required={index === 0}
                    disabled={pending}
                  />
                  <span>{t(key)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="brief-date-label" htmlFor="brief-decline-note">
            {t("briefOptionalDetails")}
          </label>
          <textarea
            className="ui-textarea brief-note"
            id="brief-decline-note"
            name="note"
            maxLength={280}
            disabled={pending}
          />
          {error?.action === "decline" ? (
            <p className="brief-error" role="alert">
              {error.message}
            </p>
          ) : null}
          <button
            className="ui-button ui-button-secondary brief-submit"
            type="submit"
            disabled={pending}
          >
            {pending ? t("briefSubmitting") : t("briefSubmitDecline")}
          </button>
          <button
            className="ui-button ui-button-secondary brief-submit"
            type="button"
            onClick={() => setMode("propose")}
            disabled={pending}
          >
            {t("briefBackToPropose")}
          </button>
        </form>
      )}
    </div>
  );
}
