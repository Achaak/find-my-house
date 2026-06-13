import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatSource(source: string): string {
  const labels: Record<string, string> = {
    bienici: "Bien'ici",
    leboncoin: "Leboncoin",
    seloger: "SeLoger",
    logicimmo: "Logic-Immo",
  };
  return labels[source] ?? source;
}
