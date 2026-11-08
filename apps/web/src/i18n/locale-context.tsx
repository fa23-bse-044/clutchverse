"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { applyLocaleToDocument, isLocale, type Locale } from "./locales";
import { messages } from "./messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setCurrentLocale] = useState(initialLocale);
  const { status } = useSession();

  const setLocale = useCallback(
    (next: Locale) => {
      setCurrentLocale(next);
      applyLocaleToDocument(next);
      window.dispatchEvent(
        new CustomEvent("clutchverse:locale", { detail: next }),
      );
      if (status === "authenticated") {
        void fetch("/api/profile/preferences", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locale: next }),
        })
          .then((response) => {
            if (!response.ok)
              throw new Error(
                `Locale preference save failed (${response.status}).`,
              );
          })
          .catch((error: unknown) =>
            console.error("Could not save locale preference.", error),
          );
      }
    },
    [status],
  );

  useEffect(() => {
    const saved = localStorage.getItem("clutchverse-locale");
    if (isLocale(saved) && saved !== initialLocale) {
      setCurrentLocale(saved);
      applyLocaleToDocument(saved);
    }
  }, [initialLocale]);

  useEffect(() => {
    const onLocaleChange = (event: Event) => {
      const next = (event as CustomEvent<unknown>).detail;
      if (isLocale(next)) setCurrentLocale(next);
    };
    window.addEventListener("clutchverse:locale", onLocaleChange);
    return () =>
      window.removeEventListener("clutchverse:locale", onLocaleChange);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context)
    throw new Error("useLocale must be used within LocaleProvider.");
  return {
    ...context,
    messages: messages[context.locale] ?? messages.en,
  };
}
