import type { ReactionRepository } from "../db/reactionRepository.js";
import type {
  CompatibilityCard,
  CompatibilityDetail,
  CompatibilityModel,
  CompatibilityPreferences,
  CompatibilityProfile,
} from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import {
  buildBatchCompatibilityRanks,
  buildPropertyCompatibilityCard,
  buildPropertyCompatibilityDetail,
  buildCompatibilityProfile,
  getCompatibilityScore,
} from "../utils/compatibility/score.js";
import { buildCompatibilityModel } from "../utils/compatibility/model.js";

let cachedModel: CompatibilityModel | null | undefined;

export function resetListingCompatibilityCache(): void {
  cachedModel = undefined;
}

export async function resolveCompatibilityModel(
  reactionRepository: ReactionRepository
): Promise<CompatibilityModel | null> {
  if (cachedModel !== undefined) {
    return cachedModel;
  }

  const { likes, dislikes } =
    await reactionRepository.loadCompatibilityTrainingData();
  cachedModel = buildCompatibilityModel(likes, dislikes);
  return cachedModel;
}

export async function resolveListingCompatibilityPreferences(
  reactionRepository: ReactionRepository
): Promise<CompatibilityPreferences | null> {
  const model = await resolveCompatibilityModel(reactionRepository);
  return model?.profile ?? null;
}

export async function resolveCompatibilityProfile(
  reactionRepository: ReactionRepository
): Promise<CompatibilityProfile> {
  const model = await resolveCompatibilityModel(reactionRepository);
  return buildCompatibilityProfile(model);
}

export function getListingCompatibilityScore(
  property: PropertyRow,
  model: CompatibilityModel | null
): number | undefined {
  return getCompatibilityScore(property, model);
}

export function getListingCompatibilityCard(
  property: PropertyRow,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityCard | undefined {
  return buildPropertyCompatibilityCard(property, model, rank);
}

export function getListingCompatibilityDetail(
  property: PropertyRow,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityDetail | undefined {
  return buildPropertyCompatibilityDetail(property, model, rank);
}

export function buildListingCompatibilityRanks(
  properties: PropertyRow[],
  model: CompatibilityModel | null
) {
  return buildBatchCompatibilityRanks(properties, model);
}
