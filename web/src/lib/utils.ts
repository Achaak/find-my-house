import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getIntlLocale } from "@/lib/locale";
import * as m from "@/paraglide/messages.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat(getIntlLocale(), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatSource(source: string): string {
  switch (source) {
    case "bienici":
      return m.source_bienici();
    case "leboncoin":
      return m.source_leboncoin();
    case "seloger":
      return m.source_seloger();
    case "logicimmo":
      return m.source_logicimmo();
    default:
      return source;
  }
}

export function parseOptionalNumber(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
