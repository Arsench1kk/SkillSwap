"use client";

import Link from "next/link";
import { useLanguage } from "@/src/i18n/provider";

/**
 * Pre-rendered in English so the page stays readable without JavaScript; with
 * JavaScript it switches to the saved language. A request-time server render
 * would need a Suspense boundary, whose streamed content is hidden without JS.
 */
export function PrivacyContent() {
  const { language, translate: t } = useLanguage();
  return (
    <main className="brief-page" lang={language}>
      <header className="brief-topbar">
        <div className="brief-topbar-inner">
          <Link className="privacy-brand" href="/">
            {t("brand")}
          </Link>
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
        <Link className="privacy-back" href="/">
          {t("privacyBack")}
        </Link>
      </article>
    </main>
  );
}
