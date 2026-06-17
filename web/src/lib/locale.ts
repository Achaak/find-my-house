import { getLocale } from "@/paraglide/runtime.js";
import type { Locale } from "@/paraglide/runtime.js";

const INTL_LOCALES: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function getIntlLocale(locale: Locale = getLocale()): string {
  return INTL_LOCALES[locale];
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(value);
}

export function formatLocaleDateTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(value);
}
