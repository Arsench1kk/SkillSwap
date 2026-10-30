"use client";

import { useLanguage, useTranslations } from "@/src/i18n/provider";

const options = [
  { value: "en", label: "EN" },
  { value: "ru", label: "RU" },
  { value: "kk", label: "KK" },
] as const;

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslations();

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t("languageLabel")}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-pressed={language === option.value}
          onClick={() => setLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
