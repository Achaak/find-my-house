import type { PrismaClient } from "../../generated/prisma/client.js";
import { computePropertyDisplayProjection } from "../../domain/propertyProjection.js";
import { computePropertyKey } from "../../utils/propertyKey.js";

export async function refreshPropertyKeys(prisma: PrismaClient): Promise<void> {
  const remaining = await prisma.property.findMany({
    include: { publications: true },
  });
  const keyUpdates: { id: number; propertyKey: string }[] = [];

  for (const property of remaining) {
    const display = computePropertyDisplayProjection(property.publications);
    const propertyKey = computePropertyKey({
      postalCode: property.postalCode,
      price: property.price,
      surface: property.surface,
      rooms: property.rooms,
      bedrooms: property.bedrooms,
      landSurface: property.landSurface,
      propertyType: display?.propertyType ?? null,
      isNewProperty: property.isNewProperty,
    });

    if (property.propertyKey !== propertyKey) {
      keyUpdates.push({ id: property.id, propertyKey });
    }
  }

  for (const { id } of keyUpdates) {
    await prisma.property.update({
      where: { id },
      data: { propertyKey: `__reconcile_${String(id)}` },
    });
  }

  for (const { id, propertyKey } of keyUpdates) {
    await prisma.property.update({
      where: { id },
      data: { propertyKey },
    });
  }
}
