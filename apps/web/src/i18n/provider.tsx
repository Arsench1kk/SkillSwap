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
import { useRouter } from "next/navigation";
import type { MessageKey } from "@/messages/en";
import {
  defaultLocale,
  isLocale,
  legacyLocaleStorageKey,
  localeCookieMaxAgeSeconds,
  localeCookieName,
  type Locale,
} from "./config";
import { createTranslator } from "./translate";

/** Kept for existing imports; identical to `Locale`. */
export type Language = Locale;

type LanguageContextValue = {
  language: Locale;
  setLanguage: (language: Locale) => void;
  translate: (key: MessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readCookieLocale(): Locale | null {
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`))
    ?.slice(localeCookieName.length + 1);
  return isLocale(value) ? value : null;
}

function readLegacyLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(legacyLocaleStorageKey);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeCookieLocale(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=${localeCookieMaxAgeSeconds}; SameSite=Lax${secure}`;
}

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: ReactNode;
  /** Pass the server-resolved locale when the caller already knows it. */
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Locale>(initialLocale);

  useEffect(() => {
    // The cookie is what the server reads; the legacy key migrates old choices.
    const timer = window.setTimeout(() => {
      const saved = readCookieLocale() ?? readLegacyLocale();
      if (saved) {
        setLanguageState(saved);
        if (!readCookieLocale()) writeCookieLocale(saved);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (next: Locale) => {
      setLanguageState(next);
      writeCookieLocale(next);
      try {
        localStorage.setItem(legacyLocaleStorageKey, next);
      } catch {
        // Storage can be unavailable; the cookie is the source of truth.
      }
      // Re-render server components that resolved the locale from the cookie.
      router.refresh();
    },
    [router],
  );

  const translate = useMemo(() => createTranslator(language), [language]);
  const value = useMemo(
    () => ({ language, setLanguage, translate }),
    [language, setLanguage, translate],
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
