import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { messages } from "@/messages/en";
import { getRatingPage } from "@/domain/rating-page";
import { PublicPageLoading } from "@/components/public-page-loading";
import { RatingForm } from "./rating-form";

export default function RatingRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <RatingContent params={params} />
    </Suspense>
  );
}

async function RatingContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const page = await getRatingPage(token);
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
        <section className="public-panel">
          <h1 className="public-title">
            {page.state === "skipped"
              ? messages.ratingSkippedTitle
              : messages.ratingTitle}
          </h1>
          {page.state === "submitted" ? (
            <p className="public-copy" role="status">
              {messages.ratingThanks}
            </p>
          ) : page.state === "skipped" ? (
            <p className="public-copy" role="status">
              {messages.ratingSkippedText}
            </p>
          ) : page.state === "partial_expired" ? (
            <section className="status-details" aria-live="polite">
              <p className="public-copy">{messages.ratingPartialExpiredText}</p>
              <RatingSummary
                unblocked={page.unblocked}
                oneLineOutcome={page.oneLineOutcome}
                trust={page.trust}
              />
            </section>
          ) : page.state === "partial" ? (
            <>
              <p className="public-copy" role="status">
                {messages.ratingPartialText}
              </p>
              <RatingForm
                token={token}
                initial={{
                  unblocked: page.unblocked,
                  oneLineOutcome: page.oneLineOutcome,
                  trust: page.trust,
                }}
              />
            </>
          ) : (
            <RatingForm token={token} />
          )}
          <Link
            className="public-text-link status-report-link"
            href={`/report/${encodeURIComponent(token)}`}
          >
            {messages.sessionReport}
          </Link>
        </section>
      </div>
    </main>
  );
}

function RatingSummary({
  unblocked,
  oneLineOutcome,
  trust,
}: {
  unblocked: number | null;
  oneLineOutcome: string | null;
  trust: number | null;
}) {
  return (
    <dl className="status-facts">
      {unblocked !== null && (
        <div>
          <dt>{messages.ratingUnblocked}</dt>
          <dd>{unblocked}</dd>
        </div>
      )}
      {oneLineOutcome !== null && (
        <div>
          <dt>{messages.ratingOutcome}</dt>
          <dd>{oneLineOutcome}</dd>
        </div>
      )}
      {trust !== null && (
        <div>
          <dt>{messages.ratingTrust}</dt>
          <dd>{trust}</dd>
        </div>
      )}
    </dl>
  );
}
