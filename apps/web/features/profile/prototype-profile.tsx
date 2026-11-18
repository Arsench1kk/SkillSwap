import { ArrowRight, Check, X } from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import styles from "@/app/prototype/prototype.module.css";
import profileStyles from "./prototype-profile.module.css";

export function PrototypeProfile({
  isDemoMode,
  editingProfile,
  displayName,
  studyArea,
  about,
  mySkills,
  accountInitials,
  account,
  role,
  addingSkill,
  skillDraft,
  onSave,
  onCancel,
  onEdit,
  onRemoveSkill,
  onToggleAddingSkill,
  onAddSkill,
  onNameChange,
  onStudyChange,
  onAboutChange,
  onSkillDraftChange,
  onContinue,
}: {
  isDemoMode: boolean;
  editingProfile: boolean;
  displayName: string;
  studyArea: string;
  about: string;
  mySkills: readonly string[];
  accountInitials: string;
  account?: { name: string; email: string };
  role: "learner" | "mentor";
  addingSkill: boolean;
  skillDraft: string;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onRemoveSkill: (skill: string) => void;
  onToggleAddingSkill: () => void;
  onAddSkill: () => void;
  onNameChange: (value: string) => void;
  onStudyChange: (value: string) => void;
  onAboutChange: (value: string) => void;
  onSkillDraftChange: (value: string) => void;
  onContinue: () => void;
}) {
  const t = useTranslations();
  return (
    <section>
      {editingProfile && isDemoMode ? (
        <form
          className={profileStyles.profileForm}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <h2>{t("prototypeNewProfileTitle")}</h2>
          <label className={styles.fieldLabel}>
            {t("prototypeDisplayName")}
            <input
              value={displayName}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("prototypeStudyArea")}
            <input
              value={studyArea}
              onChange={(event) => onStudyChange(event.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            {t("prototypeAbout")}
            <textarea
              value={about}
              onChange={(event) => onAboutChange(event.target.value)}
              rows={3}
            />
          </label>
          <div className={profileStyles.profileSkills}>
            <strong>{t("prototypeSkillListTitle")}</strong>
            <div className={profileStyles.skillChips}>
              {mySkills.map((skill) => (
                <span key={skill}>
                  {skill}
                  <button
                    aria-label={`${t("prototypeNewSkillRemove")} ${skill}`}
                    onClick={() => onRemoveSkill(skill)}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              <button
                className={profileStyles.addSkill}
                type="button"
                onClick={onToggleAddingSkill}
              >
                {t("prototypeNewSkillAdd")}
              </button>
            </div>
            {addingSkill && (
              <div className={profileStyles.addSkillForm}>
                <label className={styles.srOnly} htmlFor="new-skill">
                  {t("prototypeNewSkillPlaceholder")}
                </label>
                <input
                  id="new-skill"
                  value={skillDraft}
                  onChange={(event) => onSkillDraftChange(event.target.value)}
                  placeholder={t("prototypeNewSkillPlaceholder")}
                />
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={onAddSkill}
                >
                  {t("prototypeAddSkillAction")}
                </button>
              </div>
            )}
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={onCancel}
            >
              {t("prototypeCancel")}
            </button>
            <button
              className={`${styles.primaryButton} ${profileStyles.saveButton}`}
              type="submit"
            >
              <Check size={16} /> {t("prototypeSave")}
            </button>
          </div>
        </form>
      ) : isDemoMode ? (
        <article className={profileStyles.profileView}>
          <header className={profileStyles.profileIdentity}>
            <span className={styles.avatarProfile} aria-hidden="true">
              {displayName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <h1>{displayName}</h1>
              {studyArea && <p>{studyArea}</p>}
            </div>
            <button className={styles.secondaryButton} onClick={onEdit}>
              {t("profileEditAction")}
            </button>
          </header>
          {about && (
            <section className={profileStyles.profileSection}>
              <h2>{t("profileAboutHeading")}</h2>
              <p>{about}</p>
            </section>
          )}
          {mySkills.length > 0 && (
            <section className={profileStyles.profileSection}>
              <h2>{t("prototypeSkillListTitle")}</h2>
              <ul className={profileStyles.profileSkillList}>
                {mySkills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </section>
          )}
        </article>
      ) : (
        <article className={profileStyles.profileView}>
          <header className={profileStyles.profileIdentity}>
            <span className={styles.avatarProfile} aria-hidden="true">
              {accountInitials}
            </span>
            <div>
              <h1>{account?.name}</h1>
              <p>
                <strong>{t("prototypeProfileEmail")}:</strong> {account?.email}
              </p>
            </div>
          </header>
          <section className={profileStyles.profileSection}>
            <h2>{t("prototypeEmptyProfile")}</h2>
            <p>{t("prototypeEmptyProfileText")}</p>
            <button className={styles.primaryButton} onClick={onContinue}>
              {role === "learner"
                ? t("prototypeProfileGoToMentors")
                : t("prototypeNavHome")}{" "}
              <ArrowRight size={16} />
            </button>
          </section>
        </article>
      )}
    </section>
  );
}
