/**
 * @module @dreamer/server/i18n
 *
 * Server-side i18n for @dreamer/server: error and log messages.
 * Uses $tr + module instance, no install(); locale auto-detected from env
 * (LANGUAGE/LC_ALL/LANG) when not set.
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

/** Supported locale. */
export type Locale = "en-US" | "zh-CN";

/** Default locale when detection fails. */
export const DEFAULT_LOCALE: Locale = "en-US";

const SERVER_LOCALES: Locale[] = ["en-US", "zh-CN"];

const LOCALE_DATA: Record<string, TranslationData> = {
  "en-US": enUS as TranslationData,
  "zh-CN": zhCN as TranslationData,
};

/** Module-scoped i18n instance for server; not installed globally. */
let serverI18n: I18n | null = null;

/**
 * Detect locale (server-side): LANGUAGE > LC_ALL > LANG.
 * Falls back to DEFAULT_LOCALE when unset or not in supported list.
 */
export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return DEFAULT_LOCALE;
  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (SERVER_LOCALES.includes(normalized)) return normalized;
  }
  const primary = first.substring(0, 2).toLowerCase();
  if (primary === "zh") return "zh-CN";
  if (primary === "en") return "en-US";
  return DEFAULT_LOCALE;
}

/**
 * Create server i18n instance and set locale. Call once at entry (e.g. mod or Server).
 * Does not call install(); uses module instance only.
 */
export function initServerI18n(): void {
  if (serverI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...SERVER_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  serverI18n = i18n;
}

/**
 * Set server package locale (e.g. from HTTP options.lang). Call initServerI18n first if needed.
 */
export function setServerLocale(lang: Locale): void {
  initServerI18n();
  if (serverI18n) serverI18n.setLocale(lang);
}

/**
 * Translate by key (server-side). Uses module instance; when lang is not passed, uses current locale.
 * When init not called, returns key.
 */
export function $tr(
  key: string,
  params?: Record<string, string | number>,
  lang?: Locale,
): string {
  if (!serverI18n) return key;
  if (lang !== undefined) {
    const prev = serverI18n.getLocale();
    serverI18n.setLocale(lang);
    try {
      return serverI18n.t(key, params as TranslationParams);
    } finally {
      serverI18n.setLocale(prev);
    }
  }
  return serverI18n.t(key, params as TranslationParams);
}
