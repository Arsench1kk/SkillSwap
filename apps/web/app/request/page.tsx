import { connection } from "next/server";
import { Suspense } from "react";
import { t } from "@/messages/en";
import { PublicPageLoading } from "@/components/public-page-loading";
import { RequestForm } from "./request-form";

function almatyDateValue(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export default function RequestPage() {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <RequestFormContent />
    </Suspense>
  );
}

async function RequestFormContent() {
  await connection();
  const now = new Date();
  const minDate = almatyDateValue(now);
  const maxDate = almatyDateValue(new Date(now.getTime() + 14 * 86_400_000));
  return (
    <main className="request-page">
      <header className="brief-topbar">
        <div className="brief-topbar-inner">{t("brand")}</div>
      </header>
      <div className="request-content">
        <header className="request-heading">
          <h1>{t("requestTitle")}</h1>
          <p>{t("requestIntro")}</p>
        </header>
        <RequestForm minDate={minDate} maxDate={maxDate} />
      </div>
    </main>
  );
}
