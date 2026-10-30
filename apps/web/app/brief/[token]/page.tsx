import { connection } from "next/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { t } from "@/messages/en";
import { getMentorBriefPage } from "@/domain/mentor-brief-page";
import { MentorBriefActions } from "./mentor-brief-actions";
import { allowRateLimitedAttempt } from "@/domain/rate-limit";
import { db } from "@/db/client";
import { opsReplyMessage } from "@/domain/ops-response";

export default function MentorBriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="brief-page">
          <BriefTopbar />
          <div className="brief-content brief-state-page" role="status">
            <p>{t("briefLoading")}</p>
          </div>
        </main>
      }
    >
      <MentorBriefContent params={params} />
    </Suspense>
  );
}

async function MentorBriefContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await connection();
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientIp = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  if (
    !(await allowRateLimitedAttempt(db, "mentor-brief-page-ip", clientIp, 30))
  ) {
    return (
      <main className="brief-page">
        <BriefTopbar />
        <div className="brief-content brief-state-page" role="status">
          <h1>{t("briefRateLimited")}</h1>
        </div>
      </main>
    );
  }
  const brief = await getMentorBriefPage(token);

  if (brief.state === "expired") {
    return (
      <main className="brief-page">
        <BriefTopbar />
        <div className="brief-content brief-state-page">
          <h1>{t("briefExpiredTitle")}</h1>
          <p>{t("briefExpiredText")}</p>
        </div>
      </main>
    );
  }

  if (brief.state === "cancelled") {
    return (
      <main className="brief-page">
        <BriefTopbar />
        <div className="brief-content brief-state-page">
          <h1>{t("briefCancelledTitle")}</h1>
          <p>{t("briefCancelledText")}</p>
          <a
            className="brief-report-link"
            href={`/report/${encodeURIComponent(brief.token)}`}
          >
            {t("briefReport")}
          </a>
        </div>
      </main>
    );
  }

  if (brief.state === "withdrawn") {
    return (
      <main className="brief-page">
        <BriefTopbar />
        <div className="brief-content brief-state-page">
          <h1>{t("briefWithdrawn")}</h1>
          <p>{t("briefNextStep")}</p>
          <a
            className="brief-report-link"
            href={`/report/${encodeURIComponent(brief.token)}`}
          >
            {t("briefReport")}
          </a>
        </div>
      </main>
    );
  }

  if (brief.state === "confirmed") {
    return (
      <main className="brief-page">
        <BriefTopbar />
        <div className="brief-content brief-state-page">
          <h1>{t("briefAnsweredTitle")}</h1>
          <p>{t("briefConfirmed")}</p>
          <dl className="brief-facts brief-confirmation-facts">
            <div className="brief-fact">
              <dt>{t("briefTask")}</dt>
              <dd>{brief.confirmedTask}</dd>
            </div>
            {brief.proposedSlot && (
              <div className="brief-fact">
                <dt>{t("briefTimeChoice")}</dt>
                <dd>{brief.proposedSlot}</dd>
              </div>
            )}
          </dl>
          <p>{nextStepText()}</p>
          <a
            className="brief-report-link"
            href={`/report/${encodeURIComponent(brief.token)}`}
          >
            {t("briefReport")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="brief-page">
      <BriefTopbar />
      <div className="brief-content">
        <header className="brief-header">
          <h1>{t("briefTitle")}</h1>
          <div className="brief-task-card">
            <p className="brief-task-label">
              {t("briefTask")}
            </p>
            <p className="brief-task">{brief.taskDescription}</p>
          </div>
        </header>

        <dl className="brief-facts">
          <div className="brief-fact">
            <dt>
              {t("briefAlreadyTried")}
            </dt>
            <dd>{brief.triedAlready}</dd>
          </div>
          <div className="brief-fact">
            <dt>
              {t("briefDeadline")}
            </dt>
            <dd>{brief.deadline}</dd>
          </div>
          <div className="brief-fact">
            <dt>
              {t("briefTimeBox")}
            </dt>
            <dd>{t("briefTimeBoxValue")}</dd>
          </div>
          <div className="brief-fact">
            <dt>
              {t("briefGiveBack")}
            </dt>
            <dd>{brief.giveBack || t("briefGiveBackMissing")}</dd>
          </div>
        </dl>

        <aside className="brief-no-show">
          <div>
            <h2>{t("briefNoShowRule")}</h2>
            <p>{t("briefNoShowText")}</p>
          </div>
        </aside>
        <a
          className="brief-report-link"
          href={`/report/${encodeURIComponent(brief.token)}`}
        >
          {t("briefReport")}
        </a>

        <section
          className="brief-response"
          aria-labelledby="brief-answer-title"
        >
          <div className="brief-response-heading">
            <div>
              <h2 id="brief-answer-title">
                {brief.state === "answered"
                  ? t("briefAnsweredTitle")
                  : brief.state === "declined"
                    ? t("briefDeclinedDone")
                    : t("briefReplyStatus")}
              </h2>
              <p>
                {t("briefAnswerBy")}: <time>{brief.answerBy}</time>
              </p>
            </div>
            {brief.state === "answered" && brief.proposedSlot ? (
              <p className="brief-current-slot">
                {t("briefTimeChoice")}: <strong>{brief.proposedSlot}</strong>
              </p>
            ) : null}
          </div>
          {brief.state === "answered" ? (
            <p>{t("briefAwaitingLearner")}</p>
          ) : null}
          <MentorBriefActions
            token={brief.token}
            state={brief.state}
            windows={brief.windows ?? []}
            proposedSlotInput={brief.proposedSlotInput ?? null}
          />
        </section>

        <p className="brief-next-step">{nextStepText()}</p>
      </div>
    </main>
  );
}

function nextStepText() {
  return opsReplyMessage() ?? t("briefNextStep");
}

function BriefTopbar() {
  return (
    <header className="brief-topbar">
      <div className="brief-topbar-inner">{t("brand")}</div>
    </header>
  );
}
