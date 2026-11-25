import { ArrowLeft, ArrowRight, CalendarDays, ShieldCheck } from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import { MentorSkills } from "@/features/discovery/prototype-discovery";
import {
  capitalize,
  localizeMentor,
  type Mentor,
} from "@/features/discovery/prototype-mentors";
import styles from "@/app/prototype/prototype.module.css";
import cardStyles from "./prototype-mentor-card.module.css";

export function PrototypeMentorCard({
  mentor,
  onBack,
  onRequest,
}: {
  mentor: Mentor;
  onBack: () => void;
  onRequest: () => void;
}) {
  const t = useTranslations();
  const mentorCopy = localizeMentor(mentor, t);
  return (
    <section className={cardStyles.personPage}>
      <button className={styles.backLink} onClick={onBack}>
        <ArrowLeft size={16} /> {t("prototypeBackToResults")}
      </button>
      <div className={cardStyles.personHero}>
        <span
          className={`${styles.avatarLarge} ${cardStyles.cardAvatar} ${styles[`avatar${capitalize(mentor.color)}`]}`}
        >
          {mentor.initials}
        </span>
        <div className={cardStyles.personIdentity}>
          <h1>{mentor.name}</h1>
          <p>
            {mentorCopy.study} · {mentorCopy.city}
          </p>
          <MentorSkills skills={mentor.skills} />
        </div>
        <button
          className={`${styles.primaryButton} ${cardStyles.cardAction}`}
          onClick={onRequest}
        >
          {t("prototypeAskMentor")} <ArrowRight size={17} />
        </button>
      </div>
      <div className={cardStyles.personContent}>
        <section className={cardStyles.personAbout}>
          <h2>{t("prototypeProfileTitle")}</h2>
          <p>{mentorCopy.about}</p>
          <h3>{t("prototypeSkillEvidence")}</h3>
          <div className={cardStyles.evidenceRow}>
            <div>
              <strong>{mentorCopy.proof}</strong>
            </div>
          </div>
        </section>
        <aside className={cardStyles.personAside}>
          <h2>{t("prototypeAvailable")}</h2>
          <div className={cardStyles.availabilitySlot}>
            <CalendarDays size={18} />
            <span>{mentor.availability}</span>
          </div>
          <div className={cardStyles.howNext}>
            <strong>{t("prototypeHowItWorks")}</strong>
            <p>{t("prototypeHumanReview")}</p>
          </div>
          <p className={cardStyles.contactPrivacy}>
            <ShieldCheck size={16} /> {t("prototypeDirectoryContactRule")}
          </p>
        </aside>
      </div>
    </section>
  );
}
