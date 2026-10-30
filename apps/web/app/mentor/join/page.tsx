import Link from "next/link";
import { t } from "@/messages/en";
import { MentorJoinForm } from "./mentor-join-form";

export default function MentorJoinPage() {
  return (
    <main className="request-page">
      <header className="brief-topbar">
        <div className="brief-topbar-inner">
          <Link href="/" className="public-brand">
            {t("brand")}
          </Link>
        </div>
      </header>
      <div className="request-content">
        <header className="request-heading">
          <h1>{t("mentorJoinTitle")}</h1>
          <p>{t("mentorJoinIntro")}</p>
        </header>
        <MentorJoinForm />
      </div>
    </main>
  );
}
