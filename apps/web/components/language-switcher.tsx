"use client";

import { usePathname } from "next/navigation";
import { useLanguage, useTranslations } from "@/src/i18n/provider";

const options = [
  { value: "en", label: "EN" },
  { value: "ru", label: "RU" },
  { value: "kk", label: "KK" },
] as const;

/**
 * A real form, so the choice also works without JavaScript (POST /api/locale
 * sets the cookie and returns here). With JavaScript the switch is instant.
 */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslations();
  // Private-link tokens are path segments, so the path is enough to return.
  const returnPath = usePathname() || "/";

  return (
    <form
      className="language-switcher"
      role="group"
      aria-label={t("languageLabel")}
      method="post"
      action="/api/locale"
    >
      <input type="hidden" name="next" value={returnPath} />
      {options.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="locale"
          value={option.value}
          lang={option.value}
          aria-pressed={language === option.value}
          onClick={(event) => {
            event.preventDefault();
            setLanguage(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}
