import { connection } from "next/server";
import { Suspense } from "react";
import { getLearnerStatusPage } from "@/domain/learner-status";
import { PublicPageLoading } from "@/components/public-page-loading";
import { LearnerStatusView } from "./status-view";

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
  // Data loads on the server; the client view only picks the chosen language.
  return <LearnerStatusView page={page} />;
}
