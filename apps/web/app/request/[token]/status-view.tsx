"use client";

import Link from "next/link";
import type { LearnerStatusPageData } from "@/domain/learner-status";
import { formatKazakhstanTime } from "@/domain/time";
import type { MessageKey } from "@/messages/en";
import { useLanguage } from "@/src/i18n/provider";
import { LearnerStatusActions } from "./status-actions";

const stateCopy: Record<
  Exclude<LearnerStatusPageData["state"], "expired">,
  readonly [MessageKey, MessageKey]
> = {
  waiting: ["requestWaitingTitle", "requestWaitingText"],
  no_match: ["requestNoMatchTitle", "requestNoMatchText"],
  matched: ["requestMatchedTitle", "requestMatchedText"],
  time_declined: ["requestTimeDeclinedTitle", "requestTimeDeclinedText"],
  mentor_withdrew: ["requestMentorWithdrewTitle", "requestMentorWithdrewText"],
  session_cancelled: [
    "requestSessionCancelledTitle",
    "requestSessionCancelledText",
  ],
  confirmed: ["requestMatchAcceptedTitle", "requestMatchAcceptedText"],
  cancelled: ["requestCancelledTitle", "requestCancelledText"],
  ineligible: ["requestIneligibleTitle", "requestIneligibleStatus"],
};

export function LearnerStatusView({ page }: { page: LearnerStatusPageData }) {
  const { language, translate: t } = useLanguage();
  const formatTime = (iso: string | undefined, fallback: string | undefined) =>
    iso ? formatKazakhstanTime(new Date(iso), language) : fallback;

  if (page.state === "expired") {
    return (
      <main className="public-page">
        <div className="public-content">
          <Link className="public-brand" href="/">
            {t("brand")}
          </Link>
          <section className="public-panel" aria-labelledby="status-title">
            <h1 id="status-title" className="public-title">
              {t("requestExpiredTitle")}
            </h1>
            <p className="public-copy">{t("expiredLinkText")}</p>
          </section>
        </div>
      </main>
    );
  }

  const [titleKey, descriptionKey] = stateCopy[page.state];
  const windows = page.windowStartsAt
    ? page.windowStartsAt.map((iso) =>
        formatKazakhstanTime(new Date(iso), language),
      )
    : page.windows;

  return (
    <main className="public-page">
      <div className="public-content">
        <Link className="public-brand" href="/">
          {t("brand")}
        </Link>
        <section className="public-panel" aria-labelledby="status-title">
          <h1 id="status-title" className="public-title">
            {t(titleKey)}
          </h1>
          <p className="public-copy">{t(descriptionKey)}</p>

          {page.task && (
            <section
              className="status-details"
              aria-labelledby="request-details-title"
            >
              <h2 id="request-details-title" className="public-section-title">
                {t("requestStatusTitle")}
              </h2>
              <dl className="status-facts">
                <div>
                  <dt>{t("requestTask")}</dt>
                  <dd>{page.task}</dd>
                </div>
                <div>
                  <dt>{t("requestDeadline")}</dt>
                  <dd>{formatTime(page.deadlineAt, page.deadline)}</dd>
                </div>
                <div>
                  <dt>{t("requestAvailability")}</dt>
                  <dd>{windows?.join(" · ")}</dd>
                </div>
              </dl>
            </section>
          )}

          {page.state === "matched" && page.mentor && (
            <section
              className="status-details"
              aria-labelledby="mentor-card-title"
            >
              <h2 id="mentor-card-title" className="public-section-title">
                {t("requestMentorTitle")}
              </h2>
              <dl className="status-facts">
                {page.mentor.displayName && (
                  <div>
                    <dt>{t("requestMentorName")}</dt>
                    <dd>{page.mentor.displayName}</dd>
                  </div>
                )}
                {page.mentor.year && (
                  <div>
                    <dt>{t("requestMentorYear")}</dt>
                    <dd>{page.mentor.year}</dd>
                  </div>
                )}
                {page.mentor.skill && (
                  <div>
                    <dt>{t("requestMentorSkill")}</dt>
                    <dd>{page.mentor.skill}</dd>
                  </div>
                )}
                {page.mentor.proofType && (
                  <div>
                    <dt>{t("requestMentorProofType")}</dt>
                    <dd>{page.mentor.proofType}</dd>
                  </div>
                )}
                {page.mentor.experience && (
                  <div>
                    <dt>{t("requestMentorExperience")}</dt>
                    <dd>{page.mentor.experience}</dd>
                  </div>
                )}
              </dl>
              <p className="status-proposed">
                <strong>{t("requestProposedTime")}:</strong>{" "}
                {formatTime(page.proposedTimeAt, page.proposedTime)}
              </p>
            </section>
          )}

          {page.state === "confirmed" && page.contacts?.length ? (
            <section className="status-details" aria-labelledby="contact-title">
              <h2 id="contact-title" className="public-section-title">
                {t("requestContactDetailsTitle")}
              </h2>
              <p className="public-copy">{t("requestConfirmedMessage")}</p>
              <ul className="contact-list">
                {page.contacts.map((contact, index) => (
                  <li key={`${contact.type}-${index}`}>
                    <span>
                      {contact.type === "telegram"
                        ? t("requestContactTelegram")
                        : t("requestContactPhone")}
                    </span>
                    <bdi>{contact.value}</bdi>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <LearnerStatusActions
            state={page.state}
            token={page.token}
            deadline={page.deadlineInput ?? ""}
            windows={page.windowInputs ?? []}
          />
          <Link
            className="public-text-link status-report-link"
            href={`/report/${encodeURIComponent(page.token)}`}
          >
            {t("requestReportProblem")}
          </Link>
        </section>
      </div>
    </main>
  );
}
