import {
  ArrowRight,
  CalendarDays,
  Heart,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslations } from "@/src/i18n/provider";
import styles from "@/app/prototype/prototype.module.css";
import {
  capitalize,
  localizeMentor,
  type Mentor,
  type SkillFilter,
} from "./prototype-mentors";
import discoveryStyles from "./prototype-discovery.module.css";

const skillFilters: SkillFilter[] = [
  "all",
  "Design",
  "Data",
  "Programming",
  "Video",
];

export function PrototypeDiscovery({
  isDemoMode,
  search,
  setSearch,
  filter,
  setFilter,
  savedOnly,
  onToggleSaved,
  onClearFilters,
  favoriteIds,
  visibleMentors,
  toggleFavorite,
  openMentor,
  onNewRequest,
}: {
  isDemoMode: boolean;
  search: string;
  setSearch: (value: string) => void;
  filter: SkillFilter;
  setFilter: (value: SkillFilter) => void;
  savedOnly: boolean;
  onToggleSaved: () => void;
  onClearFilters: () => void;
  favoriteIds: readonly number[];
  visibleMentors: readonly Mentor[];
  toggleFavorite: (id: number) => void;
  openMentor: (mentor: Mentor) => void;
  onNewRequest: () => void;
}) {
  const t = useTranslations();
  return (
    <section>
      <div className={styles.screenHeading}>
        <div>
          <h1>{t("prototypeSearchTitle")}</h1>
        </div>
      </div>
      {isDemoMode ? (
        <>
          <div className={discoveryStyles.searchBar}>
            <Search size={19} />
            <input
              aria-label={t("prototypeSearchPlaceholder")}
              placeholder={t("prototypeSearchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              onClick={() => setSearch("")}
              aria-label={t("prototypeClearSearchAction")}
            >
              <X size={16} />
            </button>
          </div>
          <div className={discoveryStyles.exploreToolbar}>
            <div
              className={discoveryStyles.filterList}
              role="group"
              aria-label={t("prototypeFilterBySkill")}
            >
              {skillFilters.map((item) => (
                <button
                  key={item}
                  className={
                    filter === item ? discoveryStyles.filterActive : ""
                  }
                  onClick={() => setFilter(item)}
                >
                  {item === "all"
                    ? t("prototypeFilterAll")
                    : item === "Design"
                      ? t("prototypeFilterDesign")
                      : item === "Data"
                        ? t("prototypeFilterData")
                        : item === "Programming"
                          ? t("prototypeFilterCode")
                          : t("prototypeFilterVideo")}
                </button>
              ))}
            </div>
            <button
              className={`${discoveryStyles.filterButton} ${savedOnly ? discoveryStyles.savedFilterActive : ""}`}
              aria-pressed={savedOnly}
              onClick={onToggleSaved}
            >
              <span>
                <Heart size={16} /> {t("prototypeSaved")}
              </span>
              <span>{favoriteIds.length}</span>
            </button>
          </div>
          <div className={discoveryStyles.resultCaption}>
            {visibleMentors.length} {t("prototypeSampleProfileCount")}{" "}
            <span>·</span> {t("prototypeOnlyReviewedSkills")}
          </div>
          <div className={discoveryStyles.mentorList}>
            {visibleMentors.map((mentor) => (
              <MentorRow
                key={mentor.id}
                mentor={mentor}
                favorite={favoriteIds.includes(mentor.id)}
                onFavorite={() => toggleFavorite(mentor.id)}
                onOpen={() => openMentor(mentor)}
              />
            ))}
          </div>
          {visibleMentors.length === 0 && (
            <div className={styles.emptyState}>
              <Search size={23} />
              <h2>{t("prototypeEmptyMentorSearch")}</h2>
              <p>{t("prototypeEmptyMentorSearchHint")}</p>
              <button
                className={styles.secondaryButton}
                onClick={onClearFilters}
              >
                {t("prototypeClearFilters")}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <Search size={23} />
          <h2>{t("prototypeNoMentorsYet")}</h2>
          <p>{t("prototypeNoMentorsYetText")}</p>
          <button className={styles.primaryButton} onClick={onNewRequest}>
            {t("prototypeDescribeTask")} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

export function MentorSkills({ skills }: { skills: readonly string[] }) {
  const t = useTranslations();
  return (
    <dl className={styles.mentorSkills}>
      <dt>{t("prototypeCanHelpWith")}</dt>
      <dd>
        <ul>
          {skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </dd>
    </dl>
  );
}

function MentorRow({
  mentor,
  favorite,
  onFavorite,
  onOpen,
}: {
  mentor: Mentor;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const localizedMentor = localizeMentor(mentor, t);
  const avatarClass =
    styles[`avatar${capitalize(mentor.color)}` as keyof typeof styles];
  return (
    <article className={discoveryStyles.mentorRow}>
      <span
        className={`${styles.avatarLarge} ${discoveryStyles.mentorAvatar} ${avatarClass}`}
      >
        {mentor.initials}
      </span>
      <div className={discoveryStyles.mentorRowMain}>
        <div className={discoveryStyles.mentorNameLine}>
          <h2>{mentor.name}</h2>
          <span className={discoveryStyles.verifiedLine}>
            <ShieldCheck size={15} /> {t("prototypeProfileVerifiedMock")}
          </span>
        </div>
        <p>
          {localizedMentor.study} · {localizedMentor.city}
        </p>
        <MentorSkills skills={mentor.skills} />
        <div className={discoveryStyles.mentorAvailability}>
          <CalendarDays size={15} /> {t("prototypeAvailable")}:{" "}
          <strong>{localizedMentor.availability}</strong>
        </div>
      </div>
      <div className={discoveryStyles.mentorRowActions}>
        <button
          className={`${discoveryStyles.favoriteButton} ${favorite ? discoveryStyles.favoriteActive : ""}`}
          onClick={onFavorite}
          aria-label={
            favorite ? t("prototypeUnsaveMentor") : t("prototypeSaveMentor")
          }
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        <button
          className={`${styles.secondaryButton} ${discoveryStyles.profileButton}`}
          onClick={onOpen}
        >
          {t("prototypeViewProfile")} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}
