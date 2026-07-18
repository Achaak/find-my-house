import {
  type ListingPublication as PrismaPublication,
  type PrismaClient,
  type Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type {
  ExtendedScrapeResult,
  Listing,
  ListingSource,
  PropertyRow,
  ScrapeResult,
  UpsertStatus,
} from "../types/listing.js";
import { parseImageUrls } from "../domain/publicationImages.js";
import { parseHighlights, tryToPropertyRow } from "./listingMapper.js";
import { propertyInclude } from "./propertyInclude.js";
import {
  LoggerPropertyMatchDiagnosticsSink,
  type PropertyMatchDiagnosticsSink,
} from "./propertyMatchDiagnostics.js";
import {
  type PublicationCreateData,
  toPrismaPublicationData,
  toPublicationCreateData,
  toPublicationUpdateData,
  publicationImageUrlsChanged,
} from "./publicationData.js";
import { toPrismaSearchCacheData } from "./propertyWriteData.js";
import { computePropertyKey } from "../utils/propertyKey.js";
import { ProjectionUpdater } from "./projectionUpdater.js";
import {
  hasPropertyScalarChanges,
  toPropertyScalarData,
  type PropertyScalarData,
} from "./propertyFieldManifest.js";
import {
  collectMatchDiagnostics,
  findPendingPropertyMatch,
  findPropertyMatchForListing,
  toPropertyMatchCandidate,
} from "../domain/propertyMatching/index.js";

const IN_QUERY_BATCH_SIZE = 900;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function dedupeListings(listings: Listing[]): Listing[] {
  return [
    ...new Map(
      listings.map((listing) => [
        `${listing.source}:${listing.externalId}`,
        listing,
      ])
    ).values(),
  ];
}

function publicationKey(
  listing: Pick<Listing, "source" | "externalId">
): string {
  return `${listing.source}:${listing.externalId}`;
}

function mergeIntoPendingCreate(
  pending: PendingPropertyCreate,
  listing: Listing,
  scrapedAt: Date
): void {
  const listingKey = publicationKey(listing);

  if (listingKey !== publicationKey(pending.listing)) {
    const alreadyLinked = pending.extraPublications.some(
      (entry) => publicationKey(entry.listing) === listingKey
    );
    if (!alreadyLinked) {
      pending.extraPublications.push({ listing, scrapedAt });
    }
  }

  if (
    hasPropertyScalarChanges(toPropertyScalarData(pending.listing), listing)
  ) {
    const previousPrimary = pending.listing;
    const previousScrapedAt = pending.scrapedAt;

    if (publicationKey(previousPrimary) !== listingKey) {
      const previousPrimaryLinked = pending.extraPublications.some(
        (entry) =>
          publicationKey(entry.listing) === publicationKey(previousPrimary)
      );
      if (!previousPrimaryLinked) {
        pending.extraPublications.push({
          listing: previousPrimary,
          scrapedAt: previousScrapedAt,
        });
      }
    }

    pending.listing = listing;
    pending.scrapedAt = scrapedAt;
    pending.extraPublications = pending.extraPublications.filter(
      (entry) => publicationKey(entry.listing) !== listingKey
    );
  }
}

function pendingPublicationsToCreate(
  pending: PendingPropertyCreate
): PublicationCreateData[] {
  const seen = new Set<string>();
  const publications: PublicationCreateData[] = [];

  const add = (listing: Listing, scrapedAt: Date) => {
    const key = publicationKey(listing);
    if (seen.has(key)) return;
    seen.add(key);
    publications.push(toPublicationCreateData(listing, scrapedAt));
  };

  add(pending.listing, pending.scrapedAt);
  for (const entry of pending.extraPublications) {
    add(entry.listing, entry.scrapedAt);
  }

  return publications;
}

type PropertyWithPublications = PrismaProperty & {
  publications: PrismaPublication[];
};

type PublicationWithProperty = PrismaPublication & {
  property: PropertyWithPublications;
};

type PendingPropertyCreate = {
  listing: Listing;
  scrapedAt: Date;
  extraPublications: { listing: Listing; scrapedAt: Date }[];
};

function toPrismaPropertyData(data: PropertyScalarData) {
  return toPrismaPropertyProjectionDataFromListing(data);
}

function toPublicationComparableData(
  source: Listing | Pick<PrismaPublication, keyof PropertyScalarData>
): PropertyScalarData {
  if ("externalId" in source) {
    return toPropertyScalarData(source);
  }

  return {
    ...source,
    highlights: parseHighlights(source.highlights),
  };
}

function isPriceDrop(
  previousPrice: number,
  newPrice: number,
  firstPrice: number
): boolean {
  return previousPrice !== newPrice && newPrice < firstPrice;
}

function toPrismaPropertyProjectionDataFromListing(
  data: PropertyScalarData
): ReturnType<typeof toPrismaSearchCacheData> {
  const {
    description: _description,
    imageUrl: _imageUrl,
    ...projection
  } = data;
  return toPrismaSearchCacheData({
    ...projection,
    address: null,
    dpeNumero: null,
  });
}

export class PublicationUpsertRepository {
  private readonly projectionUpdater: ProjectionUpdater;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly refreshByIds: (ids: number[]) => Promise<PropertyRow[]>,
    private readonly diagnosticsSink: PropertyMatchDiagnosticsSink = new LoggerPropertyMatchDiagnosticsSink()
  ) {
    this.projectionUpdater = new ProjectionUpdater(prisma);
  }

  private async findExistingPublications(
    listings: Listing[]
  ): Promise<PublicationWithProperty[]> {
    const include = { property: { include: propertyInclude } };
    const byId = new Map<number, PublicationWithProperty>();

    const urls = [...new Set(listings.map((listing) => listing.url))];
    for (const urlBatch of chunk(urls, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.listingPublication.findMany({
        where: { url: { in: urlBatch } },
        include,
      });
      for (const row of rows) {
        byId.set(row.id, row);
      }
    }

    const externalIdsBySource = new Map<ListingSource, Set<string>>();
    for (const listing of listings) {
      const ids = externalIdsBySource.get(listing.source) ?? new Set<string>();
      ids.add(listing.externalId);
      externalIdsBySource.set(listing.source, ids);
    }

    for (const [source, externalIds] of externalIdsBySource) {
      for (const idBatch of chunk([...externalIds], IN_QUERY_BATCH_SIZE)) {
        const rows = await this.prisma.listingPublication.findMany({
          where: { source, externalId: { in: idBatch } },
          include,
        });
        for (const row of rows) {
          byId.set(row.id, row);
        }
      }
    }

    return [...byId.values()];
  }

  private async findPropertiesByPostalCodes(
    postalCodes: string[]
  ): Promise<PropertyWithPublications[]> {
    const byId = new Map<number, PropertyWithPublications>();

    for (const postalBatch of chunk(postalCodes, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.property.findMany({
        where: { postalCode: { in: postalBatch } },
        include: propertyInclude,
      });
      for (const row of rows) {
        byId.set(row.id, row);
      }
    }

    return [...byId.values()];
  }

  private async findPropertiesByKeys(
    propertyKeys: string[]
  ): Promise<PropertyWithPublications[]> {
    const byKey = new Map<string, PropertyWithPublications>();

    for (const keyBatch of chunk(propertyKeys, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.property.findMany({
        where: { propertyKey: { in: keyBatch } },
        include: propertyInclude,
      });
      for (const row of rows) {
        byKey.set(row.propertyKey, row);
      }
    }

    return [...byKey.values()];
  }

  private async findPropertyForListing(
    listing: Listing
  ): Promise<PropertyRow | undefined> {
    const publication = await this.prisma.listingPublication.findFirst({
      where: {
        OR: [
          { source: listing.source, externalId: listing.externalId },
          { url: listing.url },
        ],
      },
      include: { property: { include: propertyInclude } },
    });

    return publication
      ? (tryToPropertyRow(publication.property) ?? undefined)
      : undefined;
  }

  async upsert(listing: Listing): Promise<{
    status: UpsertStatus;
    row?: PropertyRow;
    priceDropped?: boolean;
  }> {
    const result = await this.upsertMany([listing]);

    if (result.skipped === 1) {
      return {
        status: "skipped",
        row: await this.findPropertyForListing(listing),
      };
    }

    if (result.inserted === 1) {
      return {
        status: "inserted",
        row: result.insertedListings[0],
      };
    }

    const row = await this.findPropertyForListing(listing);
    const priceDropped =
      row !== undefined &&
      result.priceDropListings.some((property) => property.id === row.id);

    if (result.linked === 1) {
      return { status: "linked", row, priceDropped: priceDropped || undefined };
    }

    if (result.updated === 1) {
      return {
        status: "updated",
        row,
        priceDropped: priceDropped || undefined,
      };
    }

    return { status: "skipped" };
  }

  async upsertMany(listings: Listing[]): Promise<ExtendedScrapeResult> {
    listings = dedupeListings(listings);

    if (listings.length === 0) {
      return {
        found: 0,
        inserted: 0,
        linked: 0,
        updated: 0,
        skipped: 0,
        deactivated: 0,
        insertedListings: [],
        linkedListings: [],
        priceDropListings: [],
        errors: [],
      };
    }

    const enriched = listings.map((listing) => ({
      listing,
      propertyKey: computePropertyKey(listing),
      scrapedAt: new Date(listing.scrapedAt),
    }));
    const propertyKeys = [
      ...new Set(enriched.map((entry) => entry.propertyKey)),
    ];

    const postalCodes = [
      ...new Set(
        listings
          .map((listing) => listing.postalCode)
          .filter((postalCode): postalCode is string => postalCode !== null)
      ),
    ];

    const [existingPublications, existingProperties, propertiesByPostal] =
      await Promise.all([
        this.findExistingPublications(listings),
        this.findPropertiesByKeys(propertyKeys),
        this.findPropertiesByPostalCodes(postalCodes),
      ]);

    const publicationBySourceExternalId = new Map<
      string,
      PublicationWithProperty
    >();
    const publicationByUrl = new Map<string, PublicationWithProperty>();
    for (const publication of existingPublications) {
      publicationBySourceExternalId.set(
        `${publication.source}:${publication.externalId}`,
        publication
      );
      publicationByUrl.set(publication.url, publication);
    }

    const propertyByKey = new Map(
      existingProperties.map((property) => [property.propertyKey, property])
    );
    const propertiesByPostalCode = new Map<
      string,
      PropertyWithPublications[]
    >();
    for (const property of propertiesByPostal) {
      if (!property.postalCode) continue;
      const bucket = propertiesByPostalCode.get(property.postalCode) ?? [];
      bucket.push(property);
      propertiesByPostalCode.set(property.postalCode, bucket);
    }

    const result: ScrapeResult = {
      found: listings.length,
      inserted: 0,
      linked: 0,
      updated: 0,
      skipped: 0,
      deactivated: 0,
    };
    const publicationUpdatesById = new Map<
      number,
      { listing: Listing; existing: PublicationWithProperty }
    >();
    const publicationScrapedAtById = new Map<number, Date>();
    const publicationReactivateById = new Set<number>();
    const pendingPropertyCreates = new Map<string, PendingPropertyCreate>();
    const linkedPublications: {
      propertyId: number;
      listing: Listing;
      scrapedAt: Date;
    }[] = [];
    const linkedPropertyIds = new Set<number>();
    const insertedPropertyIds: number[] = [];
    const priceDropPropertyIds = new Set<number>();

    const findExistingPublication = (
      listing: Listing
    ): PublicationWithProperty | undefined =>
      publicationBySourceExternalId.get(
        `${listing.source}:${listing.externalId}`
      ) ?? publicationByUrl.get(listing.url);

    for (const { listing, propertyKey, scrapedAt } of enriched) {
      const existingPublication = findExistingPublication(listing);

      if (existingPublication) {
        const property = existingPublication.property;
        const propertyChanged =
          hasPropertyScalarChanges(
            toPublicationComparableData(existingPublication),
            listing
          ) ||
          publicationImageUrlsChanged(
            parseImageUrls(existingPublication.imageUrls),
            listing
          );
        const needsReactivation = !existingPublication.isActive;

        if (needsReactivation) {
          publicationReactivateById.add(existingPublication.id);
        }

        publicationScrapedAtById.set(existingPublication.id, scrapedAt);

        if (!propertyChanged && !needsReactivation) {
          result.skipped++;
          continue;
        }

        if (propertyChanged) {
          publicationUpdatesById.set(existingPublication.id, {
            listing,
            existing: existingPublication,
          });
          if (isPriceDrop(property.price, listing.price, property.firstPrice)) {
            priceDropPropertyIds.add(property.id);
          }
        }

        result.updated++;
        continue;
      }

      const pendingCreate = pendingPropertyCreates.get(propertyKey);
      if (pendingCreate) {
        mergeIntoPendingCreate(pendingCreate, listing, scrapedAt);
        result.linked++;
        continue;
      }

      const fuzzyPendingCreate = findPendingPropertyMatch(
        listing,
        pendingPropertyCreates.values()
      );
      if (fuzzyPendingCreate) {
        mergeIntoPendingCreate(fuzzyPendingCreate, listing, scrapedAt);
        result.linked++;
        continue;
      }

      const existingProperty = propertyByKey.get(propertyKey);
      if (existingProperty) {
        linkedPropertyIds.add(existingProperty.id);
        linkedPublications.push({
          propertyId: existingProperty.id,
          listing,
          scrapedAt,
        });

        if (
          isPriceDrop(
            existingProperty.price,
            listing.price,
            existingProperty.firstPrice
          )
        ) {
          priceDropPropertyIds.add(existingProperty.id);
        }

        result.linked++;
        continue;
      }

      const postalCandidates = listing.postalCode
        ? (propertiesByPostalCode.get(listing.postalCode) ?? [])
        : [];
      const matchCandidates = postalCandidates.map(toPropertyMatchCandidate);
      const matchedCandidate = findPropertyMatchForListing(
        listing,
        matchCandidates
      );
      if (matchedCandidate) {
        const matchedProperty = postalCandidates.find(
          (property) => property.id === matchedCandidate.id
        );
        if (!matchedProperty) continue;

        linkedPropertyIds.add(matchedProperty.id);
        linkedPublications.push({
          propertyId: matchedProperty.id,
          listing,
          scrapedAt,
        });

        if (
          isPriceDrop(
            matchedProperty.price,
            listing.price,
            matchedProperty.firstPrice
          )
        ) {
          priceDropPropertyIds.add(matchedProperty.id);
        }

        result.linked++;
        continue;
      }
      if (matchCandidates.length > 0) {
        await this.diagnosticsSink.recordCandidateMiss(
          listing,
          collectMatchDiagnostics(listing, matchCandidates)
        );
      }

      pendingPropertyCreates.set(propertyKey, {
        listing,
        scrapedAt,
        extraPublications: [],
      });
      result.inserted++;
    }

    await this.prisma.$transaction(async (tx) => {
      const projectionRefreshIds = new Set<number>();

      for (const [
        publicationId,
        { listing, existing },
      ] of publicationUpdatesById) {
        await tx.listingPublication.update({
          where: { id: publicationId },
          data: {
            ...toPrismaPublicationData(
              toPublicationUpdateData(listing, new Date(listing.scrapedAt), {
                description: existing.description,
                imageUrl: existing.imageUrl,
                imageUrls: parseImageUrls(existing.imageUrls),
                address: existing.address,
                dpeNumero: existing.dpeNumero,
              })
            ),
            isActive: true,
          },
        });
        const publication = await tx.listingPublication.findUnique({
          where: { id: publicationId },
          select: { propertyId: true },
        });
        if (publication) {
          projectionRefreshIds.add(publication.propertyId);
        }
      }

      for (const publicationId of publicationReactivateById) {
        await tx.listingPublication.update({
          where: { id: publicationId },
          data: { isActive: true },
        });
        const publication = await tx.listingPublication.findUnique({
          where: { id: publicationId },
          select: { propertyId: true },
        });
        if (publication) {
          projectionRefreshIds.add(publication.propertyId);
        }
      }

      for (const [publicationId, nextScrapedAt] of publicationScrapedAtById) {
        await tx.listingPublication.update({
          where: { id: publicationId },
          data: { scrapedAt: nextScrapedAt },
        });
        const publication = await tx.listingPublication.findUnique({
          where: { id: publicationId },
          select: { propertyId: true },
        });
        if (publication) {
          projectionRefreshIds.add(publication.propertyId);
        }
      }

      for (const [propertyKey, pending] of pendingPropertyCreates) {
        const row = await tx.property.create({
          data: {
            propertyKey,
            ...toPrismaPropertyData(toPropertyScalarData(pending.listing)),
            firstPrice: pending.listing.price,
            hasPriceDrop: false,
            firstSeenAt: pending.scrapedAt,
            publications: {
              create: pendingPublicationsToCreate(pending).map(
                toPrismaPublicationData
              ),
            },
          },
        });
        insertedPropertyIds.push(row.id);
        projectionRefreshIds.add(row.id);
      }

      for (const link of linkedPublications) {
        await tx.listingPublication.create({
          data: {
            propertyId: link.propertyId,
            ...toPrismaPublicationData(
              toPublicationCreateData(link.listing, link.scrapedAt)
            ),
          },
        });
        await tx.property.update({
          where: { id: link.propertyId },
          data: {
            addressEnrichedAt: null,
          },
        });
        projectionRefreshIds.add(link.propertyId);
      }

      await this.projectionUpdater.refreshMany(projectionRefreshIds, tx);
    });

    const idsToRefresh = [
      ...new Set([
        ...insertedPropertyIds,
        ...priceDropPropertyIds,
        ...linkedPropertyIds,
      ]),
    ];
    const refreshedById = new Map(
      (idsToRefresh.length > 0
        ? await this.refreshByIds(idsToRefresh)
        : []
      ).map((row) => [row.id, row])
    );

    return {
      ...result,
      insertedListings: insertedPropertyIds
        .map((id) => refreshedById.get(id))
        .filter((row): row is PropertyRow => row !== undefined),
      linkedListings: [...linkedPropertyIds]
        .map((id) => refreshedById.get(id))
        .filter((row): row is PropertyRow => row !== undefined),
      priceDropListings: [...priceDropPropertyIds]
        .map((id) => refreshedById.get(id))
        .filter((row): row is PropertyRow => row !== undefined),
      errors: [],
    };
  }

  async deactivateMissingPublications(
    source: ListingSource,
    listings: Pick<Listing, "source" | "externalId" | "url">[]
  ): Promise<number> {
    const activeKeys = new Set(
      listings.map((listing) => publicationKey(listing))
    );
    const activeUrls = new Set(listings.map((listing) => listing.url));

    const publications = await this.prisma.listingPublication.findMany({
      where: { source, isActive: true },
      select: { id: true, externalId: true, url: true, propertyId: true },
    });

    const idsToDeactivate = publications
      .filter(
        (publication) =>
          !activeKeys.has(`${source}:${publication.externalId}`) &&
          !activeUrls.has(publication.url)
      )
      .map((publication) => publication.id);

    if (idsToDeactivate.length === 0) {
      return 0;
    }

    let deactivated = 0;
    for (const idBatch of chunk(idsToDeactivate, IN_QUERY_BATCH_SIZE)) {
      const result = await this.prisma.listingPublication.updateMany({
        where: { id: { in: idBatch } },
        data: { isActive: false },
      });
      deactivated += result.count;
    }

    const idsToDeactivateSet = new Set(idsToDeactivate);
    const affectedPropertyIds = [
      ...new Set(
        publications
          .filter((publication) => idsToDeactivateSet.has(publication.id))
          .map((publication) => publication.propertyId)
      ),
    ];
    if (affectedPropertyIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await this.projectionUpdater.refreshMany(affectedPropertyIds, tx);
      });
    }

    return deactivated;
  }
}
