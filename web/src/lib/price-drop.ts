import type { Property } from "@find-my-house/api-types";
import { formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

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
  return m.price_drop_format({ amount: formatPrice(drop), pct });
}
