import { ArrowRight, BookOpen, Check, Clock3 } from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import styles from "@/app/prototype/prototype.module.css";
import invitationStyles from "./prototype-invitations.module.css";

export type PrototypeInvitationStatus = "pending" | "accepted" | "declined";

type InvitationProps = {
  isDemoMode: boolean;
  invitationStates: Readonly<Record<number, PrototypeInvitationStatus>>;
  onStatusChange: (id: number, status: PrototypeInvitationStatus) => void;
};

export function PrototypeMentorHome({
  isDemoMode,
  invitationStates,
  onStatusChange,
  onOpenInvitations,
}: InvitationProps & { onOpenInvitations: () => void }) {
  const t = useTranslations();
  return (
    <>
      <section className={styles.welcomeBlock}>
        <div>
          <h1>{t("workspaceMentorHomeTitle")}</h1>
          <p>{t("workspaceMentorHomeText")}</p>
        </div>
      </section>
      <section className={invitationStyles.inboxSection}>
        <div
          className={`${styles.sectionHead} ${invitationStyles.inboxHeading}`}
        >
          <div>
            <h2>{t("prototypeInvitations")}</h2>
          </div>
          <button className={styles.textButton} onClick={onOpenInvitations}>
            {t("prototypeSeeAll")} <ArrowRight size={15} />
          </button>
        </div>
        {isDemoMode ? (
          <>
            <InvitationCard
              status={invitationStates[1] ?? "pending"}
              onAccept={() => onStatusChange(1, "accepted")}
              onDecline={() => onStatusChange(1, "declined")}
              onUndo={() => onStatusChange(1, "pending")}
              onOpen={onOpenInvitations}
            />
            <button className={styles.textButton} onClick={onOpenInvitations}>
              {t("workspaceMoreRequests")} <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <div className={styles.emptyState}>
            <h2>{t("prototypeNoInvitations")}</h2>
            <p>{t("prototypeNoInvitationsText")}</p>
          </div>
        )}
      </section>
    </>
  );
}

export function PrototypeInvitations({
  isDemoMode,
  invitationStates,
  onStatusChange,
  onOpen,
}: InvitationProps & { onOpen: (message: string) => void }) {
  const t = useTranslations();
  return (
    <section className={styles.listScreen}>
      <div className={styles.screenHeading}>
        <div>
          <h1>{t("prototypeInvitations")}</h1>
        </div>
      </div>
      {isDemoMode ? (
        <div className={invitationStyles.invitationStack}>
          <InvitationCard
            status={invitationStates[1] ?? "pending"}
            onAccept={() => onStatusChange(1, "accepted")}
            onDecline={() => onStatusChange(1, "declined")}
            onUndo={() => onStatusChange(1, "pending")}
            onOpen={() => onOpen(t("prototypeInvitationTask"))}
          />
          <InvitationCard
            compact
            status={invitationStates[2] ?? "pending"}
            onAccept={() => onStatusChange(2, "accepted")}
            onDecline={() => onStatusChange(2, "declined")}
            onUndo={() => onStatusChange(2, "pending")}
            onOpen={() => onOpen(t("prototypeSecondInvitation"))}
          />
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h2>{t("prototypeNoInvitations")}</h2>
          <p>{t("prototypeNoSessionsText")}</p>
        </div>
      )}
    </section>
  );
}

function InvitationCard({
  compact = false,
  status,
  onAccept,
  onDecline,
  onUndo,
  onOpen,
}: {
  compact?: boolean;
  status: PrototypeInvitationStatus;
  onAccept: () => void;
  onDecline: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const stateLabel =
    status === "accepted"
      ? t("prototypeInvitationStateAccepted")
      : t("prototypeInvitationStateDeclined");
  return (
    <article
      className={`${invitationStyles.invitationCard} ${compact ? invitationStyles.invitationCompact : ""}`}
    >
      <div className={invitationStyles.invitationTop}>
        <div className={invitationStyles.invitationPerson}>
          <span
            className={`${styles.avatar} ${compact ? styles.avatarGold : styles.avatarCoral}`}
          >
            {compact ? "NL" : "NM"}
          </span>
          <div>
            <strong>
              {compact
                ? t("prototypeInvitationNurlan")
                : t("prototypeInvitationNadia")}
            </strong>
            <small>{t("prototypeStudentDue")}</small>
          </div>
        </div>
      </div>
      <h3>
        {compact
          ? t("prototypeInvitationSecond")
          : t("prototypeInvitationTask")}
      </h3>
      <p>{t("prototypeInvitationMeta")}</p>
      {!compact && (
        <div className={invitationStyles.invitationExtra}>
          <span>
            <BookOpen size={16} /> {t("prototypeTriedExamples")}
          </span>
          <span>
            <Clock3 size={16} /> {t("prototypeTwoWindows")}
          </span>
        </div>
      )}
      {status === "pending" ? (
        <div className={invitationStyles.invitationActions}>
          <button
            className={`${styles.textButton} ${invitationStyles.reviewButton}`}
            onClick={onOpen}
          >
            {t("prototypeRequestReviewAction")}
          </button>
          <button className={styles.secondaryButton} onClick={onDecline}>
            {t("prototypeNotThisTime")}
          </button>
          <button className={styles.primaryButton} onClick={onAccept}>
            {t("prototypeCanHelpAction")} <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className={invitationStyles.invitationResolved}>
          <span
            className={
              status === "accepted"
                ? styles.completePill
                : invitationStyles.passedPill
            }
          >
            <Check size={14} /> {stateLabel}
          </span>
          <button className={styles.textButton} onClick={onUndo}>
            {t("prototypeUndoAction")}
          </button>
        </div>
      )}
    </article>
  );
}
