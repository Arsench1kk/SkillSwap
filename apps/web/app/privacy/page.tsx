import Link from "next/link";
import { t } from "@/messages/en";

export default function PrivacyPage() {
  return (
    <main className="brief-page">
      <header className="brief-topbar">
        <div className="brief-topbar-inner">
          <Link className="privacy-brand" href="/">{t("brand")}</Link>
        </div>
      </header>
      <article className="privacy-content">
        <h1>{t("privacyTitle")}</h1>
        <p className="privacy-intro">{t("privacyIntro")}</p>
        <section>
          <h2>{t("privacyCollectedTitle")}</h2>
          <p>{t("privacyCollectedText")}</p>
        </section>
        <section>
          <h2>{t("privacyAccessTitle")}</h2>
          <p>{t("privacyAccessText")}</p>
        </section>
        <section>
          <h2>{t("privacyContactTitle")}</h2>
          <p>{t("privacyContactText")}</p>
        </section>
        <section>
          <h2>{t("privacyWithdrawTitle")}</h2>
          <p>{t("privacyWithdrawText")}</p>
        </section>
        <aside className="privacy-review-note" role="note">
          {t("privacyReviewNotice")}
        </aside>
        <Link className="privacy-back" href="/">{t("privacyBack")}</Link>
      </article>
    </main>
  );
}
