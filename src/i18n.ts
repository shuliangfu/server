/**
 * @module @dreamer/server/i18n
 *
 * Server-side i18n for @dreamer/server: error and log messages.
 * Optional `lang`; when not passed, locale is auto-detected from env
 * (LANGUAGE/LC_ALL/LANG).
 */

import {
  $i18n,
  getGlobalI18n,
  getI18n,
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

let serverTranslationsLoaded = false;

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
 * Load server translations into the current I18n instance (once).
 */
export function ensureServerI18n(): void {
  if (serverTranslationsLoaded) return;
  const i18n = getGlobalI18n() ?? getI18n();
  i18n.loadTranslations("en-US", enUS as TranslationData);
  i18n.loadTranslations("zh-CN", zhCN as TranslationData);
  serverTranslationsLoaded = true;
}

/**
 * Translate by key (server-side). When lang is not passed, uses detectLocale().
 */
export function $t(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  ensureServerI18n();
  const current = $i18n.getLocale();
  const isSupported = (l: string): l is Locale =>
    SERVER_LOCALES.includes(l as Locale);

  if (lang !== undefined) {
    const prev = current;
    $i18n.setLocale(lang);
    try {
      return $i18n.t(key, params);
    } finally {
      $i18n.setLocale(prev);
    }
  }

  const effective: Locale = isSupported(current) ? current : detectLocale();
  $i18n.setLocale(effective);
  return $i18n.t(key, params);
}
