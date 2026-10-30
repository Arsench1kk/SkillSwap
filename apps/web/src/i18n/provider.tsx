"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type MessageKey, t as english } from "@/messages/en";
import {
  translations,
  type Language,
  type TranslationCatalog,
} from "./translations";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  translate: (key: MessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const languageStorageKey = "skillswap-language";
const supportedLanguages: readonly Language[] = ["en", "ru", "kk"];

function isLanguage(value: string | null): value is Language {
  return supportedLanguages.some((language) => language === value);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(languageStorageKey);
      if (isLanguage(stored)) setLanguage(stored);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    localStorage.setItem(languageStorageKey, language);
  }, [language, ready]);

  const translate = useCallback(
    (key: MessageKey) => {
      if (language === "en") return english(key);
      const catalog: TranslationCatalog = translations[language];
      return catalog[key] ?? messages[key];
    },
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, translate }),
    [language, translate],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

export function useTranslations() {
  return useLanguage().translate;
}
