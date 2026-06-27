import type { PrismaClient } from "../generated/prisma/client.js";
import { photoUrlDedupKey } from "../utils/images/filterSyndicatedPhotoUrls.js";

type PhotoUrlUsageRow = {
  url: string;
  property_count: bigint;
};

export class PhotoUrlUsageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOverusedPhotoUrlKeys(
    minPropertyCount: number
  ): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<PhotoUrlUsageRow[]>`
      SELECT je.value AS url, COUNT(DISTINCT lp.property_id) AS property_count
      FROM listing_publications lp, json_each(lp.image_urls) AS je
      WHERE lp.image_urls IS NOT NULL
      GROUP BY je.value
      HAVING property_count >= ${minPropertyCount}
    `;

    const blocked = new Set<string>();
    for (const row of rows) {
      blocked.add(photoUrlDedupKey(row.url));
    }
    return blocked;
  }
}
