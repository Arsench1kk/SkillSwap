import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { messages } from "@/messages/en";
import { getLearnerStatusPage } from "@/domain/learner-status";
import { PublicPageLoading } from "@/components/public-page-loading";
import { LearnerStatusActions } from "./status-actions";

export default function LearnerStatusRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <LearnerStatusContent params={params} />
    </Suspense>
  );
}

async function LearnerStatusContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const page = await getLearnerStatusPage(token);
  if (page.state === "expired") {
    return (
      <main className="public-page">
        <div className="public-content">
          <Link className="public-brand" href="/">
            {messages.brand}
          </Link>
          <section className="public-panel" aria-labelledby="status-title">
            <h1 id="status-title" className="public-title">
              {messages.requestExpiredTitle}
            </h1>
            <p className="public-copy">{messages.expiredLinkText}</p>
          </section>
        </div>
      </main>
    );
  }

  const stateCopy = {
    waiting: [messages.requestWaitingTitle, messages.requestWaitingText],
    no_match: [messages.requestNoMatchTitle, messages.requestNoMatchText],
    matched: [messages.requestMatchedTitle, messages.requestMatchedText],
    time_declined: [
      messages.requestTimeDeclinedTitle,
      messages.requestTimeDeclinedText,
    ],
    mentor_withdrew: [
      messages.requestMentorWithdrewTitle,
      messages.requestMentorWithdrewText,
    ],
    session_cancelled: [
      messages.requestSessionCancelledTitle,
      messages.requestSessionCancelledText,
    ],
    confirmed: [
      messages.requestMatchAcceptedTitle,
      messages.requestMatchAcceptedText,
    ],
    cancelled: [messages.requestCancelledTitle, messages.requestCancelledText],
    ineligible: [
      messages.requestIneligibleTitle,
      messages.requestIneligibleStatus,
    ],
  } as const;
  const [title, description] = stateCopy[page.state];

  return (
    <main className="public-page">
      <div className="public-content">
        <Link className="public-brand" href="/">
          {messages.brand}
        </Link>
        <section className="public-panel" aria-labelledby="status-title">
          <h1 id="status-title" className="public-title">
            {title}
          </h1>
          <p className="public-copy">{description}</p>

          {page.task && (
            <section
              className="status-details"
              aria-labelledby="request-details-title"
            >
              <h2 id="request-details-title" className="public-section-title">
                {messages.requestStatusTitle}
              </h2>
              <dl className="status-facts">
                <div>
                  <dt>{messages.requestTask}</dt>
                  <dd>{page.task}</dd>
                </div>
                <div>
                  <dt>{messages.requestDeadline}</dt>
                  <dd>{page.deadline}</dd>
                </div>
                <div>
                  <dt>{messages.requestAvailability}</dt>
                  <dd>{page.windows?.join(" · ")}</dd>
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
                {messages.requestMentorTitle}
              </h2>
              <dl className="status-facts">
                {page.mentor.displayName && (
                  <div>
                    <dt>{messages.requestMentorName}</dt>
                    <dd>{page.mentor.displayName}</dd>
                  </div>
                )}
                {page.mentor.year && (
                  <div>
                    <dt>{messages.requestMentorYear}</dt>
                    <dd>{page.mentor.year}</dd>
                  </div>
                )}
                {page.mentor.skill && (
                  <div>
                    <dt>{messages.requestMentorSkill}</dt>
                    <dd>{page.mentor.skill}</dd>
                  </div>
                )}
                {page.mentor.proofType && (
                  <div>
                    <dt>{messages.requestMentorProofType}</dt>
                    <dd>{page.mentor.proofType}</dd>
                  </div>
                )}
                {page.mentor.experience && (
                  <div>
                    <dt>{messages.requestMentorExperience}</dt>
                    <dd>{page.mentor.experience}</dd>
                  </div>
                )}
              </dl>
              <p className="status-proposed">
                <strong>{messages.requestProposedTime}:</strong>{" "}
                {page.proposedTime}
              </p>
            </section>
          )}

          {page.state === "confirmed" && page.contacts?.length ? (
            <section className="status-details" aria-labelledby="contact-title">
              <h2 id="contact-title" className="public-section-title">
                {messages.requestContactDetailsTitle}
              </h2>
              <p className="public-copy">{messages.requestConfirmedMessage}</p>
              <ul className="contact-list">
                {page.contacts.map((contact, index) => (
                  <li key={`${contact.type}-${index}`}>
                    <span>
                      {contact.type === "telegram"
                        ? messages.requestContactTelegram
                        : messages.requestContactPhone}
                    </span>
                    <bdi>{contact.value}</bdi>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <LearnerStatusActions
            state={page.state}
            token={token}
            deadline={page.deadlineInput ?? ""}
            windows={page.windowInputs ?? []}
          />
          <Link
            className="public-text-link status-report-link"
            href={`/report/${encodeURIComponent(token)}`}
          >
            {messages.requestReportProblem}
          </Link>
        </section>
      </div>
    </main>
  );
}
