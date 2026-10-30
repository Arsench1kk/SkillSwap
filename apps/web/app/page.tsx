"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Compass,
  Home as HomeIcon,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./welcome.module.css";

export default function Home() {
  const t = useTranslations();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/" aria-label={t("brand")}>
          <span className={styles.brandMark} aria-hidden="true">
            s
          </span>
          {t("brand")}
        </Link>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <Link className={styles.loginLink} href="/login">
            {t("onboardingLogIn")}
          </Link>
        </div>
      </header>
      <div className={styles.intro}>
        <section className={styles.heroCopy} aria-labelledby="welcome-title">
          <h1 id="welcome-title">{t("onboardingHeadline")}</h1>
          <p className={styles.lead}>{t("onboardingDescription")}</p>
          <Link className={styles.primaryAction} href="/signup">
            {t("onboardingCreateAccount")}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <a className={styles.secondaryAction} href="#example">
            {t("onboardingSeeHow")}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
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
      <section
        id="example"
        className={styles.example}
        aria-labelledby="example-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sampleBadge}>
              {t("onboardingExampleBadge")}
            </span>
            <h2 id="example-title">{t("onboardingExampleTitle")}</h2>
          </div>
        </div>
        <div className={styles.exampleGrid}>
          <article className={styles.exampleRequest}>
            <h3>{t("prototypeTaskLabel")}</h3>
            <p>{t("onboardingExampleRequest")}</p>
          </article>
          <article className={styles.sampleMentor}>
            <div className={styles.sampleMentorHeader}>
              <span className={styles.sampleAvatar} aria-hidden="true">
                AS
              </span>
              <div>
                <h3>{t("onboardingSampleMentor")}</h3>
                <p>{t("onboardingSampleUniversity")}</p>
              </div>
              <span className={styles.sampleBadge}>
                {t("onboardingExampleBadge")}
              </span>
            </div>
            <p>{t("onboardingSampleSkills")}</p>
          </article>
        </div>
      </section>
      <section className={styles.preview} aria-labelledby="preview-title">
        <div className={styles.previewHeading}>
          <div>
            <span className={styles.sampleBadge}>
              {t("onboardingPreviewTitle")}
            </span>
            <h2 id="preview-title">{t("workspaceLearnerHomeTitle")}</h2>
          </div>
        </div>
        <div className={styles.previewFrame}>
          <nav
            className={styles.previewNav}
            aria-label={t("workspaceNavigate")}
          >
            <span className={styles.previewBrand}>{t("brand")}</span>
            <span>
              <HomeIcon size={17} aria-hidden="true" />
              {t("onboardingPreviewHome")}
            </span>
            <span>
              <Compass size={17} aria-hidden="true" />
              {t("onboardingPreviewFindMentor")}
            </span>
            <span>
              <MessageCircle size={17} aria-hidden="true" />
              {t("onboardingPreviewRequests")}
            </span>
            <span>
              <CalendarDays size={17} aria-hidden="true" />
              {t("onboardingPreviewSessions")}
            </span>
            <span>
              <UserRound size={17} aria-hidden="true" />
              {t("prototypeNavProfile")}
            </span>
          </nav>
          <div className={styles.previewContent}>
            <h3>{t("onboardingPreviewQuestion")}</h3>
            <p>{t("onboardingPreviewDescription")}</p>
            <span className={styles.previewAction}>
              {t("onboardingPreviewAction")}
              <ArrowRight size={16} aria-hidden="true" />
            </span>
            <article className={styles.previewRequest}>
              <BookOpen size={19} aria-hidden="true" />
              <div>
                <strong>{t("onboardingPreviewCardTitle")}</strong>
                <p>{t("onboardingPreviewCardText")}</p>
              </div>
            </article>
          </div>
        </div>
      </section>
      <section className={styles.how} aria-labelledby="how-title">
        <h2 id="how-title">{t("onboardingHowTitle")}</h2>
        <ol>
          <li>
            <strong>{t("onboardingStepOneTitle")}</strong>
            <p>{t("onboardingStepOneText")}</p>
          </li>
          <li>
            <strong>{t("onboardingStepTwoTitle")}</strong>
            <p>{t("onboardingStepTwoText")}</p>
          </li>
          <li>
            <strong>{t("onboardingStepThreeTitle")}</strong>
            <p>{t("onboardingStepThreeText")}</p>
          </li>
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
