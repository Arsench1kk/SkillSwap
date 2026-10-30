import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { t } from "@/messages/en";
import styles from "./welcome.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label={t("brand")}>
          <span className={styles.brandMark} aria-hidden="true">s</span>
          {t("brand")}
        </Link>
        <Link className={styles.loginLink} href="/login">{t("onboardingLogIn")}</Link>
      </header>
      <div className={styles.intro}>
        <section className={styles.heroCopy} aria-labelledby="welcome-title">
          <h1 id="welcome-title">{t("onboardingHeadline")}</h1>
          <p className={styles.lead}>{t("onboardingDescription")}</p>
          <Link className={styles.primaryAction} href="/signup">
            {t("onboardingCreateAccount")}<ArrowRight size={20} aria-hidden="true" />
          </Link>
          <p className={styles.eligibility}>{t("onboardingEligibility")}</p>
        </section>
        <div className={styles.illustration}>
          <Image
            src="/images/skillswap-skill-exchange.png"
            alt={t("onboardingExchangeAlt")}
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 719px) calc(100vw - 32px), (max-width: 1199px) 50vw, 560px"
          />
        </div>
      </div>
      <section className={styles.how} aria-labelledby="how-title">
        <h2 id="how-title">{t("onboardingHowTitle")}</h2>
        <ol>
          <li><strong>{t("onboardingStepOneTitle")}</strong><p>{t("onboardingStepOneText")}</p></li>
          <li><strong>{t("onboardingStepTwoTitle")}</strong><p>{t("onboardingStepTwoText")}</p></li>
          <li><strong>{t("onboardingStepThreeTitle")}</strong><p>{t("onboardingStepThreeText")}</p></li>
        </ol>
      </section>
      <footer className={styles.footer}>
        <p>{t("onboardingNotCourse")}</p>
        <div>
          <Link href="/request">{t("onboardingExistingRequest")}</Link>
          <Link href="/privacy">{t("requestPrivacyLink")}</Link>
        </div>
      </footer>
    </main>
  );
}
