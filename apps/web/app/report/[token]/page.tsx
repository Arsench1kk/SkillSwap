import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { messages } from "@/messages/en";
import { getReportParticipant } from "@/domain/report-page";
import { PublicPageLoading } from "@/components/public-page-loading";
import { ReportForm } from "./report-form";

export default function ReportRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <ReportContent params={params} />
    </Suspense>
  );
}

async function ReportContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const participant = await getReportParticipant(token);
  if (!participant)
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
  const hours = Number(process.env.OPS_REPLY_HOURS);
  const responseText =
    Number.isInteger(hours) && hours > 0
      ? messages.reportReplyHours.replace("{hours}", String(hours))
      : messages.reportReplyUnspecified;
  return (
    <main className="public-page">
      <div className="public-content">
        <Link className="public-brand" href="/">
          {messages.brand}
        </Link>
        <section className="public-panel">
          <h1 className="public-title">{messages.reportTitle}</h1>
          <p className="public-copy">{messages.reportIntro}</p>
          <ReportForm token={token} responseText={responseText} />
        </section>
      </div>
    </main>
  );
}
