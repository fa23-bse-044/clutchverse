import ar from "./ar";
import en from "./en";
import es from "./es";
import hi from "./hi";
import ur from "./ur";
import zh from "./zh";
import type { Locale } from "../locales";
import type { MessageCatalog } from "../types";

export const messages: Record<Locale, MessageCatalog> = {
  en,
  ur,
  ar,
  zh,
  hi,
  es,
};
