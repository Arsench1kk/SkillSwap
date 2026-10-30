import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { messages } from "@/messages/en";
import { getSessionPage } from "@/domain/session-page";
import { PublicPageLoading } from "@/components/public-page-loading";
import { SessionActions } from "./session-actions";

export default function SessionRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <SessionContent params={params} />
    </Suspense>
  );
}

async function SessionContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const page = await getSessionPage(token);
  if (page.state === "expired")
    return (
      <main className="public-page">
        <div className="public-content">
          <Link className="public-brand" href="/">
            {messages.brand}
          </Link>
          <section className="public-panel">
            <h1 className="public-title">{messages.requestExpiredTitle}</h1>
            <p className="public-copy">{messages.expiredLinkText}</p>
          </section>
        </div>
      </main>
    );

  return (
    <main className="public-page">
      <div className="public-content">
        <Link className="public-brand" href="/">
          {messages.brand}
        </Link>
        <article className="public-panel">
          <h1 className="public-title">{messages.sessionTitle}</h1>
          <p className="session-task">{page.task}</p>
          <p className="public-copy">
            {page.startsAt ?? messages.sessionTimePending}
          </p>
          {page.completionState === "cancelled" ? (
            <p className="privacy-review-note">{messages.sessionCancelled}</p>
          ) : (
            <>
              {!page.meetUrl && (
                <p className="privacy-review-note">
                  {messages.sessionMeetMissing}
                </p>
              )}
              <section className="status-details">
                <h2 className="public-section-title">
                  {messages.sessionPlanTitle}
                </h2>
                <ol className="session-plan">
                  <li>{messages.sessionStepOne}</li>
                  <li>{messages.sessionStepTwo}</li>
                  <li>{messages.sessionStepThree}</li>
                  <li>{messages.sessionStepFour}</li>
                </ol>
              </section>
              <section className="status-details">
                <h2 className="public-section-title">
                  {messages.sessionRulesTitle}
                </h2>
                <ul className="session-rules">
                  <li>{messages.sessionRuleOnTime}</li>
                  <li>{messages.sessionRulePrivacy}</li>
                </ul>
              </section>
              <SessionActions
                token={token}
                state={page.completionState ?? "scheduled"}
                meetUrl={page.meetUrl}
              />
            </>
          )}
          <Link
            className="public-text-link status-report-link"
            href={`/report/${encodeURIComponent(token)}`}
          >
            {messages.sessionReport}
          </Link>
        </article>
      </div>
    </main>
  );
}
