import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Video,
} from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import styles from "@/app/prototype/prototype.module.css";
import sessionStyles from "./prototype-sessions.module.css";

export type PrototypeSessionTab = "upcoming" | "past";

export function PrototypeSessions({
  isDemoMode,
  sessionTab,
  setSessionTab,
  onOpenDemoMeeting,
  onExplore,
}: {
  isDemoMode: boolean;
  sessionTab: PrototypeSessionTab;
  setSessionTab: (tab: PrototypeSessionTab) => void;
  onOpenDemoMeeting: () => void;
  onExplore: () => void;
}) {
  const t = useTranslations();

  return (
    <section className={styles.listScreen}>
      <div className={styles.screenHeading}>
        <div>
          <h1>{t("prototypeSessionsTitle")}</h1>
        </div>
      </div>
      {isDemoMode ? (
        <>
          <div className={sessionStyles.sessionTabs}>
            <button
              className={
                sessionTab === "upcoming" ? sessionStyles.sessionTabActive : ""
              }
              onClick={() => setSessionTab("upcoming")}
            >
              {t("prototypeUpcomingTab")} <span>1</span>
            </button>
            <button
              className={
                sessionTab === "past" ? sessionStyles.sessionTabActive : ""
              }
              onClick={() => setSessionTab("past")}
            >
              {t("prototypePastTab")} <span>2</span>
            </button>
          </div>
          {sessionTab === "upcoming" ? (
            <div className={sessionStyles.sessionDetailCard}>
              <div className={sessionStyles.sessionCalendar}>
                <strong>24</strong>
                <span>{t("prototypeOctoberShort")}</span>
              </div>
              <div className={sessionStyles.sessionDetailMain}>
                <span className={sessionStyles.confirmedPill}>
                  <CheckCircle2 size={14} /> {t("prototypeStatusConfirmedDemo")}
                </span>
                <h2>{t("prototypeSessionTitle")}</h2>
                <p>{t("prototypeSessionMeta")}</p>
                <div className={sessionStyles.sessionMeta}>
                  <span>
                    <CalendarDays size={15} /> {t("prototypeSessionDate")}
                  </span>
                  <span>
                    <Clock3 size={15} /> {t("prototypeSessionDuration")}
                  </span>
                </div>
                <div className={sessionStyles.sessionPlan}>
                  <strong>{t("prototypeSessionDetails")}</strong>
                  <p>{t("prototypeSessionPlan")}</p>
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={onOpenDemoMeeting}
                >
                  <Video size={17} /> {t("prototypeJoinSession")}
                </button>
              </div>
            </div>
          ) : (
            <div className={sessionStyles.pastSessions}>
              <div className={sessionStyles.pastSessionRow}>
                <span className={`${styles.avatar} ${styles.avatarGreen}`}>
                  TK
                </span>
                <div>
                  <strong>{t("prototypeSessionHistoryTitle")}</strong>
                  <small>{t("prototypeSessionHistoryDateOne")}</small>
                </div>
                <span
                  className={`${styles.completePill} ${sessionStyles.historyStatus}`}
                >
                  <Check size={14} /> {t("prototypeSessionCompleted")}
                </span>
              </div>
              <div className={sessionStyles.pastSessionRow}>
                <span className={`${styles.avatar} ${styles.avatarCoral}`}>
                  MB
                </span>
                <div>
                  <strong>{t("prototypeSessionHistoryFigma")}</strong>
                  <small>{t("prototypeSessionHistoryDateTwo")}</small>
                </div>
                <span
                  className={`${styles.completePill} ${sessionStyles.historyStatus}`}
                >
                  <Check size={14} /> {t("prototypeSessionCompleted")}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <h2>{t("prototypeNoSessions")}</h2>
          <p>{t("prototypeNoSessionsText")}</p>
          <button className={styles.primaryButton} onClick={onExplore}>
            {t("prototypeNoSessionsAction")} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
