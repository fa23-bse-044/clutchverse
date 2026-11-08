export const locales = ["en", "ur", "ar", "zh", "hi", "es"] as const;

export type Locale = (typeof locales)[number];
export type TextDirection = "ltr" | "rtl";

export const languageOptions: ReadonlyArray<{
  code: Locale;
  name: string;
  nativeName: string;
}> = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "中文（简体）" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "es", name: "Spanish", nativeName: "Español" },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

export function getDirection(locale: Locale): TextDirection {
  return locale === "ur" || locale === "ar" ? "rtl" : "ltr";
}

export function applyLocaleToDocument(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = getDirection(locale);
  localStorage.setItem("clutchverse-locale", locale);
  document.cookie = `clutchverse-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function formatLocalizedNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatLocalizedDate(
  value: Date | string | number,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(value instanceof Date ? value : new Date(value));
}
