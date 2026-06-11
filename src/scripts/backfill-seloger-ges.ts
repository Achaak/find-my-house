import "dotenv/config";
import { getPrisma, disconnectPrisma } from "../db/prisma.js";
import { fetchSeLogerListingDetails } from "../utils/seloger/index.js";
import { normalizeEnergyClass } from "../utils/energyClass.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL manquant");

const prisma = getPrisma(databaseUrl);

const propertyId = Number(process.argv[2] ?? "536");
const property = await prisma.property.findUnique({
  where: { id: propertyId },
  include: {
    publications: { where: { source: "seloger" }, take: 1 },
  },
});

if (!property) throw new Error(`Property ${String(propertyId)} introuvable`);

const publication = property.publications[0];
if (!publication.url) {
  throw new Error(`Aucune publication SeLoger pour #${String(propertyId)}`);
}

const details = await fetchSeLogerListingDetails(publication.url);
const gesClass = normalizeEnergyClass(details.gesClass);
const dpeClass = normalizeEnergyClass(details.dpeClass);

console.log(`#${String(propertyId)} depuis ${publication.url}`);
console.log("Extrait:", details);

await prisma.property.update({
  where: { id: propertyId },
  data: {
    ...(dpeClass ? { dpeClass } : {}),
    ...(gesClass ? { gesClass } : {}),
    ...(details.dpeConsumptionKwhM2 !== null
      ? { dpeConsumptionKwhM2: details.dpeConsumptionKwhM2 }
      : {}),
    ...(details.gesEmissionKgM2 !== null
      ? { gesEmissionKgM2: details.gesEmissionKgM2 }
      : {}),
    ...(details.landSurface !== null
      ? { landSurface: details.landSurface }
      : {}),
    ...(details.description ? { description: details.description } : {}),
  },
});

console.log("Mis à jour.");

await disconnectPrisma();
