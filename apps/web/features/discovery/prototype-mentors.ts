import type { MessageKey } from "@/messages/en";
import type { useTranslations } from "@/src/i18n/provider";

export type SkillFilter = "all" | "Design" | "Data" | "Programming" | "Video";
export type Mentor = {
  id: 1 | 2 | 3 | 4;
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
export const mentors: Mentor[] = [
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

const mentorCopyKeys: Record<
  Mentor["id"],
  {
    study: MessageKey;
    proof: MessageKey;
    about: MessageKey;
    availability: MessageKey;
  }
> = {
  1: {
    study: "prototypeSampleMentorOneStudy",
    proof: "prototypeSampleMentorOneProof",
    about: "prototypeSampleMentorOneAbout",
    availability: "prototypeSampleMentorOneAvailability",
  },
  2: {
    study: "prototypeSampleMentorTwoStudy",
    proof: "prototypeSampleMentorTwoProof",
    about: "prototypeSampleMentorTwoAbout",
    availability: "prototypeSampleMentorTwoAvailability",
  },
  3: {
    study: "prototypeSampleMentorThreeStudy",
    proof: "prototypeSampleMentorThreeProof",
    about: "prototypeSampleMentorThreeAbout",
    availability: "prototypeSampleMentorThreeAvailability",
  },
  4: {
    study: "prototypeSampleMentorFourStudy",
    proof: "prototypeSampleMentorFourProof",
    about: "prototypeSampleMentorFourAbout",
    availability: "prototypeSampleMentorFourAvailability",
  },
};

export function localizeMentor(
  mentor: Mentor,
  t: ReturnType<typeof useTranslations>,
) {
  const copy = mentorCopyKeys[mentor.id];
  return {
    ...mentor,
    study: t(copy.study),
    city:
      mentor.city === "Almaty" ? t("prototypeAlmaty") : t("prototypeAstana"),
    proof: t(copy.proof),
    about: t(copy.about),
    availability: t(copy.availability),
  };
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
