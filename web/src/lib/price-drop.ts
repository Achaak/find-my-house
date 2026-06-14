import type { Property } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export function hasPriceDrop(
  property: Pick<Property, "price" | "firstPrice">
): boolean {
  return property.price < property.firstPrice;
}

export function formatPriceDrop(
  property: Pick<Property, "price" | "firstPrice">
): string | null {
  if (!hasPriceDrop(property)) return null;

  const drop = property.firstPrice - property.price;
  const pct = Math.round((drop / property.firstPrice) * 100);
  return `−${formatPrice(drop)} (−${String(pct)}%)`;
}
