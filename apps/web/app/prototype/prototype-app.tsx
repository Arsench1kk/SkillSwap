"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { t } from "@/messages/en";
import { RequestForm } from "@/app/request/request-form";
import { authClient } from "@/src/lib/auth-client";
import styles from "./prototype.module.css";

type Role = "learner" | "mentor";
type Screen =
  | "home"
  | "explore"
  | "requests"
  | "sessions"
  | "profile"
  | "settings"
  | "mentor-profile"
  | "new-request";
type SkillFilter = "all" | "Design" | "Data" | "Programming" | "Video";
type Mentor = {
  id: number;
  name: string;
  initials: string;
  study: string;
  city: string;
  category: Exclude<SkillFilter, "all">;
  skills: string[];
  proof: string;
  availability: string;
  about: string;
  color: "blue" | "green" | "gold" | "coral";
};
type Request = {
  id: number;
  title: string;
  detail: string;
  state: "Team review" | "Time proposed" | "Confirmed" | "Completed";
  person: string;
  date: string;
};

const mentors: Mentor[] = [
  {
    id: 1,
    name: "Aigerim S.",
    initials: "AS",
    study: "Information systems · Year 3",
    city: "Almaty",
    category: "Data",
    skills: ["Excel", "Power Query", "Data visualization"],
    proof: "Dashboard project reviewed by the team",
    availability: "Thu · 18:30",
    about:
      "I like turning messy spreadsheets into clear, useful dashboards. Happy to work through one real task together.",
    color: "blue",
  },
  {
    id: 2,
    name: "Timur K.",
    initials: "TK",
    study: "Computer science · Year 4",
    city: "Almaty",
    category: "Programming",
    skills: ["Python", "Pandas", "Jupyter"],
    proof: "Course project and code sample reviewed",
    availability: "Fri · 16:00",
    about:
      "I can help you find the bug, understand the error, and leave with a way to solve the next one yourself.",
    color: "green",
  },
  {
    id: 3,
    name: "Mira B.",
    initials: "MB",
    study: "Visual communication · Year 2",
    city: "Astana",
    category: "Design",
    skills: ["Figma", "Layout", "Design systems"],
    proof: "Portfolio work reviewed by the team",
    availability: "Sat · 11:00",
    about:
      "I enjoy making complex screens feel simple. Bring a draft and we can improve one part at a time.",
    color: "coral",
  },
  {
    id: 4,
    name: "Dias A.",
    initials: "DA",
    study: "Media production · Year 3",
    city: "Almaty",
    category: "Video",
    skills: ["Premiere Pro", "Color", "Audio"],
    proof: "Editing work sample reviewed by the team",
    availability: "Sun · 14:00",
    about:
      "I can help untangle an editing workflow or make a rough cut feel more intentional.",
    color: "gold",
  },
];

const initialRequests: Request[] = [
  {
    id: 1,
    title: "Build a pivot table that updates automatically",
    detail: t("prototypeTaskCategory"),
    state: "Time proposed",
    person: "Aigerim S.",
    date: t("prototypeTimeOptionOne"),
  },
  {
    id: 2,
    title: "Understand why my Python chart is empty",
    detail: "Programming · due 31 Oct",
    state: "Team review",
    person: "SkillSwap team",
    date: "Waiting for review",
  },
];

const skillFilters: SkillFilter[] = [
  "all",
  "Design",
  "Data",
  "Programming",
  "Video",
];

const iconForScreen = {
  home: Home,
  explore: Compass,
  requests: MessageCircle,
  sessions: CalendarDays,
  profile: UserRound,
  settings: Settings,
} satisfies Record<
  Exclude<Screen, "mentor-profile" | "new-request">,
  typeof Home
>;

export function PrototypeApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession } = authClient.useSession();
  const requestedRole: Role =
    searchParams.get("role") === "mentor" ? "mentor" : "learner";
  const [roleSelection, setRoleSelection] = useState<Role | null>(null);
  const role =
    roleSelection ??
    (authSession?.user.activeRole === "mentor"
      ? "mentor"
      : authSession?.user
        ? "learner"
        : requestedRole);
  const [screen, setScreen] = useState<Screen>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedMentor, setSelectedMentor] = useState<Mentor>(mentors[0]);
  const [requests, setRequests] = useState(initialRequests);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsLoadError, setRequestsLoadError] = useState(false);
  const [requestDateRange, setRequestDateRange] = useState({ min: "", max: "" });
  const [favoriteIds, setFavoriteIds] = useState<number[]>([2]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [invitationStates, setInvitationStates] = useState<
    Record<number, "pending" | "accepted" | "declined">
  >({ 1: "pending", 2: "pending" });
  const [toast, setToast] = useState("");
  const [sessionTab, setSessionTab] = useState<"upcoming" | "past">("upcoming");
  const [task, setTask] = useState("");
  const [deadline, setDeadline] = useState("2026-10-28");
  const [timeWindow, setTimeWindow] = useState<string>(t("prototypeTimeOptionOne"));
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const displayName =
    displayNameDraft || authSession?.user.name || "Arsen Abduhalyk";
  const [studyArea, setStudyArea] = useState("Business analytics · Year 3");
  const [about, setAbout] = useState(
    "Learning by building things with other students.",
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSnapshot, setProfileSnapshot] = useState<{ name: string; study: string; about: string; skills: string[] } | null>(null);
  const accountDisplayName = editingProfile && profileSnapshot ? profileSnapshot.name : displayName;
  const [profileVisible, setProfileVisible] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [mySkills, setMySkills] = useState([
    "Excel basics",
    "Presentation design",
  ]);
  const [skillDraft, setSkillDraft] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);

  const loadAccountRequests = useCallback(async () => {
    if (!authSession?.user || role !== "learner") return;
    setRequestsLoading(true);
    setRequestsLoadError(false);
    try {
      const response = await fetch("/api/account/requests", { cache: "no-store" });
      if (!response.ok) throw new Error("requests_unavailable");
      const data = (await response.json()) as {
        requests: Array<{
          id: string;
          taskDescription: string;
          taskCategory: string | null;
          status: string;
          deadlineAt: string;
          createdAt: string;
        }>;
      };
      setRequests(data.requests.map((request, index) => ({
        id: index + 1,
        title: request.taskDescription,
        detail: `${request.taskCategory ?? t("prototypeTaskCategory")} · ${new Date(request.deadlineAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Almaty" })}`,
        state: request.status === "slot_proposed" ? "Time proposed" : "Team review",
        person: "SkillSwap team",
        date: new Date(request.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Almaty" }),
      })));
    } catch {
      setRequestsLoadError(true);
    } finally {
      setRequestsLoading(false);
    }
  }, [authSession?.user, role]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccountRequests(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccountRequests]);

  const almatyDate = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = new Date();
      setRequestDateRange({
        min: almatyDate(today),
        max: almatyDate(new Date(today.getTime() + 14 * 86_400_000)),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeRole = async (nextRole: Role) => {
    const previousRole = role;
    setRoleSelection(nextRole);
    openScreen("home");
    if (!authSession?.user) return;

    const result = await authClient.updateUser({ activeRole: nextRole });
    if (result.error) {
      setRoleSelection(previousRole);
      notify(t("prototypeRoleSaveFailed"));
    }
  };

  const signOut = async () => {
    const result = await authClient.signOut();
    if (result.error) {
      notify(t("prototypeSignOutFailed"));
      return;
    }
    router.push("/");
  };

  const visibleMentors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mentors.filter((mentor) => {
      const matchesFilter = filter === "all" || mentor.category === filter;
      const text = [mentor.name, mentor.study, mentor.city, ...mentor.skills]
        .join(" ")
        .toLowerCase();
      const matchesSaved = !savedOnly || favoriteIds.includes(mentor.id);
      return matchesFilter && matchesSaved && (!query || text.includes(query));
    });
  }, [favoriteIds, filter, savedOnly, search]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const cancelProfileEdit = () => {
    if (profileSnapshot) {
      setDisplayNameDraft(profileSnapshot.name);
      setStudyArea(profileSnapshot.study);
      setAbout(profileSnapshot.about);
      setMySkills([...profileSnapshot.skills]);
    }
    setEditingProfile(false);
    setAddingSkill(false);
    setSkillDraft("");
  };

  const openScreen = (next: Screen) => {
    if (editingProfile) cancelProfileEdit();
    setScreen(next);
    setMobileNavOpen(false);
    if (next !== "mentor-profile") setSearch("");
  };

  const openMentor = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    setScreen("mentor-profile");
    setMobileNavOpen(false);
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTask = task.trim();
    if (!cleanTask) return;
    setRequests((current) => [
      {
        id: Date.now(),
        title: cleanTask,
        detail: `Preferred mentor: ${selectedMentor.name} · due ${new Date(`${deadline}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        state: "Team review",
        person: "SkillSwap team",
        date: timeWindow,
      },
      ...current,
    ]);
    setTask("");
    setScreen("requests");
    notify(t("prototypeRequestSentForReview"));
  };

  const toggleFavorite = (id: number) => {
    setFavoriteIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const setInvitationStatus = (
    id: number,
    status: "pending" | "accepted" | "declined",
  ) => {
    setInvitationStates((current) => ({ ...current, [id]: status }));
    notify(
      status === "accepted"
        ? t("prototypeAcceptedToast")
        : status === "declined"
          ? t("prototypeDeclinedToast")
          : t("prototypeUndo"),
    );
  };

  const saveSkill = () => {
    const cleanSkill = skillDraft.trim();
    if (!cleanSkill) return;
    setMySkills((current) => [...current, cleanSkill]);
    setSkillDraft("");
    setAddingSkill(false);
  };

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  const navItems: {
    id: Exclude<Screen, "mentor-profile" | "new-request">;
    label: string;
  }[] =
    role === "learner"
      ? [
          { id: "home", label: t("prototypeNavHome") },
          { id: "explore", label: t("prototypeNavExplore") },
          { id: "requests", label: t("prototypeNavRequests") },
          { id: "sessions", label: t("prototypeNavSessions") },
          { id: "profile", label: t("prototypeNavProfile") },
          { id: "settings", label: t("prototypeNavSettings") },
        ]
      : [
          { id: "home", label: t("prototypeNavHome") },
          { id: "requests", label: t("prototypeNavInvitations") },
          { id: "sessions", label: t("prototypeNavSessions") },
          { id: "profile", label: t("prototypeNavProfile") },
          { id: "settings", label: t("prototypeNavSettings") },
        ];

  return (
    <div
      className={`${styles.prototypeShell} ${sidebarCollapsed ? styles.prototypeShellCollapsed : ""}`}
    >
      {mobileNavOpen && (
        <button
          className={styles.mobileBackdrop}
          aria-label={t("workspaceMenuBackdrop")}
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarMobileOpen : ""}`}
      >
        <div className={styles.sidebarTop}>
          <button
            className={styles.wordmark}
            onClick={() => openScreen("home")}
            aria-label={t("prototypeWorkspaceTitle")}
          >
            <span className={styles.brandGlyph}>s</span>
            <span className={styles.wordmarkText}>{t("brand")}</span>
          </button>
          <button
            className={`${styles.sidebarToggle} ${styles.desktopSidebarToggle}`}
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={
              sidebarCollapsed ? t("workspaceExpand") : t("workspaceCollapse")
            }
            aria-expanded={!sidebarCollapsed}
            title={
              sidebarCollapsed ? t("workspaceExpand") : t("workspaceCollapse")
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
          <button
            className={`${styles.sidebarToggle} ${styles.mobileSidebarClose}`}
            onClick={() => setMobileNavOpen(false)}
            aria-label={t("workspaceCloseNavigation")}
          >
            <X size={19} />
          </button>
        </div>
        <div className={styles.sidebarDivider} />
        <nav className={styles.sideNav} aria-label={t("workspaceNavigate")}>
          <p className={styles.navCaption}>{t("prototypeWorkspaceCaption")}</p>
          {navItems.map((item) => {
            const Icon = iconForScreen[item.id];
            return (
              <button
                key={item.id}
                className={`${styles.navItem} ${screen === item.id ? styles.navItemActive : ""}`}
                onClick={() => openScreen(item.id)}
                aria-current={screen === item.id ? "page" : undefined}
                aria-label={item.label}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={19} strokeWidth={1.9} />{" "}
                <span className={styles.navLabel}>{item.label}</span>
                {item.id === "requests" && role === "mentor" && (
                  <span className={styles.navCount}>2</span>
                )}
                {item.id === "sessions" && role === "learner" && (
                  <span className={styles.navDot} />
                )}
              </button>
            );
          })}
        </nav>
        <div className={styles.sidebarBottom}>
          <button
            className={styles.accountButton}
            onClick={() => openScreen("profile")}
          >
            <span className={`${styles.avatar} ${styles.avatarBlue}`}>AA</span>
            <span className={styles.accountText}>
              <strong>{accountDisplayName}</strong>
              <small>
                {role === "learner"
                  ? t("prototypeLearnerAccountLabel")
                  : t("prototypeMentorAccountLabel")}
              </small>
            </span>
            <ChevronDown size={16} />
          </button>
        </div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <button
              className={styles.mobileMenuButton}
              onClick={() => setMobileNavOpen(true)}
              aria-label={t("workspaceOpenNavigation")}
              aria-expanded={mobileNavOpen}
              aria-controls="workspace-navigation"
            >
              <Menu size={20} />
            </button>
            <button
              className={styles.wordmark}
              onClick={() => openScreen("home")}
            >
              <span className={styles.brandGlyph}>s</span>
              <span>{t("brand")}</span>
            </button>
          </div>
          <div className={styles.topbarActions}>
            <div
              className={styles.roleSwitch}
              role="group"
              aria-label={t("prototypeSwitchRole")}
            >
              <button
                className={role === "learner" ? styles.roleActive : ""}
                onClick={() => void changeRole("learner")}
                aria-pressed={role === "learner"}
              >
                {t("prototypeLearnerRole")}
              </button>
              <button
                className={role === "mentor" ? styles.roleActive : ""}
                onClick={() => void changeRole("mentor")}
                aria-pressed={role === "mentor"}
              >
                {t("prototypeMentorRole")}
              </button>
            </div>
            <button
              className={styles.iconButton}
              aria-label={t("prototypeNotificationLabel")}
              onClick={() => notify(t("prototypeCaughtUpToast"))}
            >
              <Bell size={19} />

            </button>
            <button
              className={styles.topAvatar}
              onClick={() => openScreen("profile")}
              aria-label={t("prototypeNavProfile")}
            >
              AA
            </button>
          </div>
        </header>

        <div className={styles.contentWrap}>
          {screen === "home" && role === "learner" && (
            <>
              <section className={styles.welcomeBlock}>
                <div>
                  <h1>{t("workspaceLearnerHomeTitle")}</h1>
                  <p>{t("workspaceLearnerHomeText")}</p>
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={() => openScreen("explore")}
                >
                  {t("prototypeFindMentor")} <ArrowRight size={17} />
                </button>
              </section>
              <section
                className={styles.workspaceFocus}
                aria-labelledby="current-request-title"
              >
                <div className={styles.focusHeader}>
                  <div>
                    <h2 id="current-request-title">
                      {requests[0]
                        ? t("workspaceCurrentRequest")
                        : t("workspaceNoRequest")}
                    </h2>
                    <span>{t("workspaceDemoSample")}</span>
                  </div>
                  {requests[0] && (
                    <span className={styles.focusStatus}>
                      {requests[0].state === "Time proposed"
                        ? t("workspaceRequestTime")
                        : t("workspaceRequestWaiting")}
                    </span>
                  )}
                </div>
                {requests[0] ? (
                  <>
                    <h3>{requests[0].title}</h3>
                    <p className={styles.focusDetail}>{requests[0].detail}</p>
                    <div className={styles.focusFooter}>
                      <p>{t("workspaceRequestNext")}</p>
      
                    </div>
                  </>
                ) : (
                  <>
                    <p className={styles.focusDetail}>
                      {t("workspaceNoRequestText")}
                    </p>
                    <button
                      className={styles.textButton}
                      onClick={() => openScreen("explore")}
                    >
                      {t("prototypeFindMentor")} <ArrowRight size={15} />
                    </button>
                  </>
                )}
              </section>
            </>
          )}

          {screen === "home" && role === "mentor" && (
            <>
              <section className={styles.welcomeBlock}>
                <div>
                  <h1>{t("workspaceMentorHomeTitle")}</h1>
                  <p>{t("workspaceMentorHomeText")}</p>
                </div>

              </section>
              <section className={styles.inboxSection}>
                <div className={styles.sectionHead}>
                  <div>
                    <h2>{t("prototypeInvitations")}</h2>
                  </div>
                  <button
                    className={styles.textButton}
                    onClick={() => openScreen("requests")}
                  >
                    {t("prototypeSeeAll")} <ArrowRight size={15} />
                  </button>
                </div>
                <InvitationCard
                  status={invitationStates[1]}
                  onAccept={() => setInvitationStatus(1, "accepted")}
                  onDecline={() => setInvitationStatus(1, "declined")}
                  onUndo={() => setInvitationStatus(1, "pending")}
                  onOpen={() => openScreen("requests")}
                />
                <button
                  className={styles.textButton}
                  onClick={() => openScreen("requests")}
                >
                  {t("workspaceMoreRequests")} <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}

          {screen === "explore" && (
            <section className={styles.exploreScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeSearchTitle")}</h1>
                </div>

              </div>
              <div className={styles.searchBar}>
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
              <div className={styles.exploreToolbar}>
                <div
                  className={styles.filterList}
                  role="group"
                  aria-label={t("prototypeFilterBySkill")}
                >
                  {skillFilters.map((item) => (
                    <button
                      key={item}
                      className={filter === item ? styles.filterActive : ""}
                      onClick={() => setFilter(item)}
                    >
                      {item === "all" ? t("prototypeFilterAll") : item}
                    </button>
                  ))}
                </div>
                <button
                  className={`${styles.filterButton} ${savedOnly ? styles.savedFilterActive : ""}`}
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly((value) => !value)}
                >
                  <span>
                    <Heart size={16} /> {t("prototypeSaved")}
                  </span>
                  <span>{favoriteIds.length}</span>
                </button>
              </div>
              <div className={styles.resultCaption}>
                {visibleMentors.length} {t("prototypeSampleProfileCount")}{" "}
                <span>·</span> {t("prototypeOnlyReviewedSkills")}
              </div>
              <div className={styles.mentorList}>
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
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                      setSavedOnly(false);
                    }}
                  >
                    {t("prototypeClearFilters")}
                  </button>
                </div>
              )}
            </section>
          )}

          {screen === "mentor-profile" && (
            <section className={styles.personPage}>
              <button
                className={styles.backLink}
                onClick={() => openScreen("explore")}
              >
                <ArrowLeft size={16} /> {t("prototypeBackToResults")}
              </button>
              <div className={styles.personHero}>
                <span
                  className={`${styles.avatarLarge} ${styles[`avatar${capitalize(selectedMentor.color)}`]}`}
                >
                  {selectedMentor.initials}
                </span>
                <div className={styles.personIdentity}>

                  <h1>{selectedMentor.name}</h1>
                  <p>
                    {selectedMentor.study} · {selectedMentor.city}
                  </p>
                  <MentorSkills skills={selectedMentor.skills} />
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={() => openScreen("new-request")}
                >
                  {t("prototypeAskMentor")} <ArrowRight size={17} />
                </button>
              </div>
              <div className={styles.personContent}>
                <section className={styles.personAbout}>
                  <h2>{t("prototypeProfileTitle")}</h2>
                  <p>{selectedMentor.about}</p>
                  <h3>{t("prototypeSkillEvidence")}</h3>
                  <div className={styles.evidenceRow}>

                    <div>
                      <strong>{selectedMentor.proof}</strong>
                    </div>
                  </div>
                </section>
                <aside className={styles.personAside}>
                  <h2>{t("prototypeAvailable")}</h2>
                  <div className={styles.availabilitySlot}>
                    <CalendarDays size={18} />
                    <span>{selectedMentor.availability}</span>
                  </div>
                  <div className={styles.howNext}>
                    <strong>{t("prototypeHowItWorks")}</strong>
                    <p>{t("prototypeHumanReview")}</p>
                  </div>
                  <p className={styles.contactPrivacy}>
                    <ShieldCheck size={16} />{" "}
                    {t("prototypeDirectoryContactRule")}
                  </p>
                </aside>
              </div>
            </section>
          )}

          {screen === "new-request" && (
            <section className={styles.formScreen}>
              <button
                className={styles.backLink}
                onClick={() => authSession?.user ? openScreen("requests") : openMentor(selectedMentor)}
              >
                <ArrowLeft size={16} /> {authSession?.user ? t("prototypeRequestsTitle") : selectedMentor.name}
              </button>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeRequestFormTitle")}</h1>
                </div>
              </div>
              {authSession?.user ? (
                <RequestForm
                  minDate={requestDateRange.min}
                  maxDate={requestDateRange.max}
                  mode="account"
                  onComplete={() => {
                    openScreen("requests");
                    void loadAccountRequests();
                    notify(t("prototypeRequestSentForReview"));
                  }}
                />
              ) : <form className={styles.requestForm} onSubmit={submitRequest}>
                <div className={styles.formMentor}>
                  <span
                    className={`${styles.avatar} ${styles[`avatar${capitalize(selectedMentor.color)}`]}`}
                  >
                    {selectedMentor.initials}
                  </span>
                  <div>
                    <small>{t("prototypeUncontactedPreference")}</small>
                    <strong>{selectedMentor.name}</strong>
                  </div>

                </div>
                <label className={styles.fieldLabel}>
                  {t("prototypeTaskLabel")}
                  <textarea
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    placeholder={t("prototypeTaskPlaceholder")}
                    required
                    rows={4}
                  />
                </label>
                <div className={styles.formTwoCol}>
                  <label className={styles.fieldLabel}>
                    {t("prototypeDeadlineLabel")}
                    <input
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      required
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    {t("prototypeTimeLabel")}
                    <select
                      value={timeWindow}
                      onChange={(event) => setTimeWindow(event.target.value)}
                    >
                      <option>{t("prototypeTimeOptionOne")}</option>
                      <option>{t("prototypeTimeOptionTwo")}</option>
                      <option>{t("prototypeTimeOptionThree")}</option>
                    </select>
                  </label>
                </div>
                <div className={styles.formNotice}>
                  <ShieldCheck size={18} />
                  <p>{t("prototypeMentorRequestMeaning")}</p>
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => openMentor(selectedMentor)}
                  >
                    {t("prototypeCancel")}
                  </button>
                  <button className={styles.primaryButton} type="submit">
                    {t("prototypeSubmitRequest")} <ArrowRight size={16} />
                  </button>
                </div>
              </form>}
            </section>
          )}

          {screen === "requests" && role === "learner" && (
            <section className={styles.listScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeRequestsTitle")}</h1>
                </div>
                <button
                  className={styles.primaryButton}
                  onClick={() => openScreen("new-request")}
                >
                  {t("prototypeSubmitRequest")} <ArrowRight size={17} />
                </button>
              </div>
              {authSession?.user && requestsLoading ? <p role="status">{t("prototypeRequestsLoading")}</p> : null}
              {authSession?.user && requestsLoadError ? (
                <div role="alert" className={styles.formNotice}>
                  <p>{t("prototypeRequestsLoadError")}</p>
                  <button className={styles.textButton} onClick={() => void loadAccountRequests()}>{t("prototypeRetry")}</button>
                </div>
              ) : null}
              {!requestsLoading && !requestsLoadError && requests.length === 0 ? (
                <p>{t("prototypeNoRequests")}</p>
              ) : null}
              <div className={styles.requestList}>
                {requests.map((request) => (
                  <RequestDetail
                    key={request.id}
                    request={request}
                    onOpen={() => notify(`${request.state} · ${request.date}`)}
                  />
                ))}
              </div>

            </section>
          )}

          {screen === "requests" && role === "mentor" && (
            <section className={styles.listScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeInvitations")}</h1>
                </div>

              </div>
              <div className={styles.invitationStack}>
                <InvitationCard
                  status={invitationStates[1]}
                  onAccept={() => setInvitationStatus(1, "accepted")}
                  onDecline={() => setInvitationStatus(1, "declined")}
                  onUndo={() => setInvitationStatus(1, "pending")}
                  onOpen={() => notify(t("prototypeInvitationTask"))}
                />
                <InvitationCard
                  compact
                  status={invitationStates[2]}
                  onAccept={() => setInvitationStatus(2, "accepted")}
                  onDecline={() => setInvitationStatus(2, "declined")}
                  onUndo={() => setInvitationStatus(2, "pending")}
                  onOpen={() => notify(t("prototypeSecondInvitation"))}
                />
              </div>
            </section>
          )}

          {screen === "sessions" && (
            <section className={styles.listScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeSessionsTitle")}</h1>
                </div>
              </div>
              <div className={styles.sessionTabs}>
                <button
                  className={
                    sessionTab === "upcoming" ? styles.sessionTabActive : ""
                  }
                  onClick={() => setSessionTab("upcoming")}
                >
                  {t("prototypeUpcomingTab")} <span>1</span>
                </button>
                <button
                  className={
                    sessionTab === "past" ? styles.sessionTabActive : ""
                  }
                  onClick={() => setSessionTab("past")}
                >
                  {t("prototypePastTab")} <span>2</span>
                </button>
              </div>
              {sessionTab === "upcoming" ? (
                <div className={styles.sessionDetailCard}>
                  <div className={styles.sessionCalendar}>
                    <strong>24</strong>
                    <span>OCT</span>
                  </div>
                  <div className={styles.sessionDetailMain}>
                    <span className={styles.confirmedPill}>
                      <CheckCircle2 size={14} />{" "}
                      {t("prototypeStatusConfirmedDemo")}
                    </span>
                    <h2>{t("prototypeSessionTitle")}</h2>
                    <p>{t("prototypeSessionMeta")}</p>
                    <div className={styles.sessionMeta}>
                      <span>
                        <CalendarDays size={15} /> {t("prototypeSessionDate")}
                      </span>
                      <span>
                        <Clock3 size={15} /> {t("prototypeSessionDuration")}
                      </span>
                    </div>
                    <div className={styles.sessionPlan}>
                      <strong>{t("prototypeSessionDetails")}</strong>
                      <p>{t("prototypeSessionPlan")}</p>
                    </div>
                    <button
                      className={styles.primaryButton}
                      onClick={() => notify(t("prototypeDemoMeetingToast"))}
                    >
                      <Video size={17} /> {t("prototypeJoinSession")}
                    </button>
                  </div>

                </div>
              ) : (
                <div className={styles.pastSessions}>
                  <div className={styles.pastSessionRow}>
                    <span className={`${styles.avatar} ${styles.avatarGreen}`}>
                      TK
                    </span>
                    <div>
                      <strong>{t("prototypeSessionHistoryTitle")}</strong>
                      <small>{t("prototypeSessionHistoryDateOne")}</small>
                    </div>
                    <span className={styles.completePill}>
                      <Check size={14} /> {t("prototypeSessionCompleted")}
                    </span>
                  </div>
                  <div className={styles.pastSessionRow}>
                    <span className={`${styles.avatar} ${styles.avatarCoral}`}>
                      MB
                    </span>
                    <div>
                      <strong>{t("prototypeSessionHistoryFigma")}</strong>
                      <small>{t("prototypeSessionHistoryDateTwo")}</small>
                    </div>
                    <span className={styles.completePill}>
                      <Check size={14} /> {t("prototypeSessionCompleted")}
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}

          {screen === "profile" && (
            <section className={styles.profileScreen}>
              {editingProfile ? (
                <form
                  className={styles.profileForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    setEditingProfile(false);
                    setAddingSkill(false);
                    setSkillDraft("");
                    notify(t("prototypeProfileSavedToast"));
                  }}
                >
                  <h2>{t("prototypeNewProfileTitle")}</h2>
                  <label className={styles.fieldLabel}>
                    {t("prototypeDisplayName")}
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    {t("prototypeStudyArea")}
                    <input
                      value={studyArea}
                      onChange={(event) => setStudyArea(event.target.value)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    {t("prototypeAbout")}
                    <textarea
                      value={about}
                      onChange={(event) => setAbout(event.target.value)}
                      rows={3}
                    />
                  </label>
                  <div className={styles.profileSkills}>
                    <strong>{t("prototypeSkillListTitle")}</strong>
                    <div className={styles.skillChips}>
                      {mySkills.map((skill) => (
                        <span key={skill}>
                          {skill}
                          <button
                            aria-label={`${t("prototypeNewSkillRemove")} ${skill}`}
                            onClick={() => {
                              setMySkills((current) =>
                                current.filter((item) => item !== skill),
                              );
                            }}
                            type="button"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                      <button
                        className={styles.addSkill}
                        type="button"
                        onClick={() => setAddingSkill((value) => !value)}
                      >
                        {t("prototypeNewSkillAdd")}
                      </button>
                    </div>
                    {addingSkill && (
                      <div className={styles.addSkillForm}>
                        <label className={styles.srOnly} htmlFor="new-skill">
                          {t("prototypeNewSkillPlaceholder")}
                        </label>
                        <input
                          id="new-skill"
                          value={skillDraft}
                          onChange={(event) =>
                            setSkillDraft(event.target.value)
                          }
                          placeholder={t("prototypeNewSkillPlaceholder")}
                        />
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={saveSkill}
                        >
                          {t("prototypeAddSkillAction")}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.formActions}>
                  <button className={styles.secondaryButton} type="button" onClick={cancelProfileEdit}>{t("prototypeCancel")}</button>
                  <button className={styles.primaryButton} type="submit">
                    <Check size={16} /> {t("prototypeSave")}
                  </button>
                  </div>
                </form>
              ) : (
                <article className={styles.profileView}>
                  <header className={styles.profileIdentity}>
                    <span className={styles.avatarProfile} aria-hidden="true">
                      {displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </span>
                    <div>
                      <h1>{displayName}</h1>
                      <p>{studyArea}</p>
                    </div>
                    <button className={styles.secondaryButton} onClick={() => {
                      setProfileSnapshot({ name: displayName, study: studyArea, about, skills: [...mySkills] });
                      setEditingProfile(true);
                    }}>{t("profileEditAction")}</button>
                  </header>
                  {about && <section className={styles.profileSection}>
                    <h2>{t("profileAboutHeading")}</h2>
                    <p>{about}</p>
                  </section>}
                  <section className={styles.profileSection}>
                    <h2>{t("prototypeSkillListTitle")}</h2>
                    <ul className={styles.profileSkillList}>
                      {mySkills.map((skill) => <li key={skill}>{skill}</li>)}
                    </ul>
                  </section>
                </article>
              )}
            </section>
          )}

          {screen === "settings" && (
            <section className={styles.settingsScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <h1>{t("prototypeSettingsTitle")}</h1>
                </div>
              </div>
              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupHeading}>
                  <ShieldCheck size={19} />
                  <div>
                    <h2>{t("prototypeContactSharingTitle")}</h2>
                    <p>{t("prototypeContactSharingHint")}</p>
                  </div>
                </div>
                <SettingToggle
                  title={t("prototypePublicProfile")}
                  detail={t("prototypePublicProfileHint")}
                  checked={profileVisible}
                  onChange={() => setProfileVisible((value) => !value)}
                />
                <SettingToggle
                  title={t("prototypeNotifications")}
                  detail={t("prototypeNotificationSettingHint")}
                  checked={notifications}
                  onChange={() => setNotifications((value) => !value)}
                />
                <button
                  className={styles.settingsLink}
                  onClick={() => router.push("/privacy")}
                >
                  <span>
                    <strong>{t("prototypePrivacy")}</strong>
                    <small>{t("prototypePrivacyReview")}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className={styles.settingsGroup}>
                <div className={styles.settingsGroupHeading}>
                  <Settings size={19} />
                  <div>
                    <h2>{t("prototypePreferenceTitle")}</h2>
                    <p>{t("prototypePreferenceHint")}</p>
                  </div>
                </div>
                <label className={styles.languageSetting}>
                  {t("prototypeLanguage")}
                  <span lang="en">English</span>
                </label>
                <button
                  className={styles.settingsLink}
                  onClick={() =>
                    authSession?.user ? openScreen("profile") : router.push("/login")
                  }
                >
                  <span>
                    <strong>{authSession?.user.name ?? t("prototypeSignIn")}</strong>
                    <small>
                      {authSession?.user.email ?? t("prototypeSwitchDemoAccount")}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
                <button
                  className={`${styles.settingsLink} ${styles.signOutLink}`}
                  onClick={() =>
                    authSession?.user
                      ? void signOut()
                      : router.push("/signup")
                  }
                >
                  <span>
                    <strong>
                      {authSession?.user
                        ? t("prototypeSignOut")
                        : t("onboardingCreateAccount")}
                    </strong>
                    <small>
                      {authSession?.user
                        ? t("prototypeReturnToSignIn")
                        : t("prototypeCreateAccountHint")}
                    </small>
                  </span>
                  <LogOut size={17} />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
      {toast && (
        <div className={styles.toast} role="status">
          <CheckCircle2 size={18} /> {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function RequestDetail({
  request,
  onOpen,
}: {
  request: Request;
  onOpen: () => void;
}) {
  return (
    <article className={styles.requestDetail}>
      <div className={styles.requestDetailTop}>
        <span
          className={
            request.state === "Time proposed"
              ? styles.requestStateBlue
              : styles.requestStateNeutral
          }
        >
          <span /> {request.state}
        </span>
        <span>{request.date}</span>
      </div>
      <h2>{request.title}</h2>
      <p>{request.detail}</p>
      <div className={styles.requestDetailBottom}>
        <span>
          <UserRound size={15} /> {request.person}
        </span>
        <button className={styles.textButton} onClick={onOpen}>
          {t("prototypeOpenRequest")} <ArrowRight size={15} />
        </button>
      </div>
    </article>
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
  status: "pending" | "accepted" | "declined";
  onAccept: () => void;
  onDecline: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const stateLabel =
    status === "accepted"
      ? t("prototypeInvitationStateAccepted")
      : t("prototypeInvitationStateDeclined");
  return (
    <article
      className={`${styles.invitationCard} ${compact ? styles.invitationCompact : ""}`}
    >
      <div className={styles.invitationTop}>
        <div className={styles.invitationPerson}>
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
        <div className={styles.invitationExtra}>
          <span>
            <BookOpen size={16} /> {t("prototypeTriedExamples")}
          </span>
          <span>
            <Clock3 size={16} /> {t("prototypeTwoWindows")}
          </span>
        </div>
      )}
      {status === "pending" ? (
        <div className={styles.invitationActions}>
          <button className={styles.textButton} onClick={onOpen}>
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
        <div className={styles.invitationResolved}>
          <span
            className={
              status === "accepted" ? styles.completePill : styles.passedPill
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

function MentorSkills({ skills }: { skills: readonly string[] }) {
  return (
    <dl className={styles.mentorSkills}>
      <dt>{t("prototypeCanHelpWith")}</dt>
      <dd>
        <ul>
          {skills.map((skill) => <li key={skill}>{skill}</li>)}
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
  const avatarClass =
    styles[`avatar${capitalize(mentor.color)}` as keyof typeof styles];
  return (
    <article className={styles.mentorRow}>
      <span className={`${styles.avatarLarge} ${avatarClass}`}>
        {mentor.initials}
      </span>
      <div className={styles.mentorRowMain}>
        <div className={styles.mentorNameLine}>
          <h2>{mentor.name}</h2>
          <span className={styles.verifiedLine}>
            <ShieldCheck size={15} /> {t("prototypeProfileVerifiedMock")}
          </span>
        </div>
        <p>
          {mentor.study} · {mentor.city}
        </p>
        <MentorSkills skills={mentor.skills} />
        <div className={styles.mentorAvailability}>
          <CalendarDays size={15} /> {t("prototypeAvailable")}:{" "}
          <strong>{mentor.availability}</strong>
        </div>
      </div>
      <div className={styles.mentorRowActions}>
        <button
          className={`${styles.favoriteButton} ${favorite ? styles.favoriteActive : ""}`}
          onClick={onFavorite}
          aria-label={
            favorite ? t("prototypeUnsaveMentor") : t("prototypeSaveMentor")
          }
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
        <button className={styles.secondaryButton} onClick={onOpen}>
          {t("prototypeViewProfile")} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function SettingToggle({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className={styles.settingToggle}>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
