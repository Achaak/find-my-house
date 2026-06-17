import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  MessageFlagsBitField,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { EnrichmentQueue } from "../services/enrichmentQueue.js";
import { propertyNeedsEnrichment } from "../services/enrichmentService.js";
import {
  advanceBrowseSession,
  clearBrowseSession,
  getBrowseSession,
  noteBrowseReaction,
  startBrowseSession,
  type BrowseSession,
} from "../services/browseSession.js";
import { formatListingEmbedWithCompatibility } from "./listingEmbed.js";

const LIKE_PREFIX = "browse:like:";
const DISLIKE_PREFIX = "browse:dislike:";
const STOP_PREFIX = "browse:stop";

export function buildBrowseActionRow(propertyId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${LIKE_PREFIX}${String(propertyId)}`)
      .setLabel("Like")
      .setEmoji("❤️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${DISLIKE_PREFIX}${String(propertyId)}`)
      .setLabel("Dislike")
      .setEmoji("👎")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(STOP_PREFIX)
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Secondary)
  );
}

function browseHeader(options: {
  shownCount: number;
  isExplore: boolean;
  hasPreferences: boolean;
}): string {
  const parts = [`📍 **Browse** — ${String(options.shownCount)} viewed`];

  if (options.isExplore) {
    parts.push("_Outside comfort zone — broaden your criteria._");
  } else if (!options.hasPreferences) {
    parts.push("_Like listings to enable the compatibility score._");
  }

  return parts.join("\n");
}

export async function buildBrowseReply(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  enrichmentQueue: EnrichmentQueue,
  discordUserId: string,
  session: BrowseSession
): Promise<
  | {
      content: string;
      embeds: Awaited<ReturnType<typeof formatListingEmbedWithCompatibility>>[];
      components: ReturnType<typeof buildBrowseActionRow>[];
    }
  | { content: string; embeds: []; components: [] }
> {
  const state = await advanceBrowseSession(
    repository,
    reactionRepository,
    discordUserId,
    session
  );

  if (!state.property) {
    return {
      content:
        "✅ No more listings to browse with your current criteria.\n" +
        "Use `/listings` to broaden your search or wait for new listings.",
      embeds: [],
      components: [],
    };
  }

  let property = state.property;
  if (propertyNeedsEnrichment(property, "display")) {
    await enrichmentQueue.waitUntilEnriched(property.id, "display", "high");
    property = (await repository.findById(property.id)) ?? property;
  }

  const embed = await formatListingEmbedWithCompatibility(
    property,
    reactionRepository,
    state.model ?? undefined
  );

  return {
    content: browseHeader({
      shownCount: state.shownCount,
      isExplore: state.isExplore,
      hasPreferences: state.hasPreferences,
    }),
    embeds: [embed],
    components: [buildBrowseActionRow(property.id)],
  };
}

type ParsedBrowseButton =
  | { action: "like" | "dislike"; propertyId: number }
  | { action: "stop" };

function parseBrowseButtonCustomId(
  customId: string
): ParsedBrowseButton | null {
  if (customId === STOP_PREFIX) {
    return { action: "stop" };
  }

  if (customId.startsWith(LIKE_PREFIX)) {
    const propertyId = Number(customId.slice(LIKE_PREFIX.length));
    return Number.isInteger(propertyId) && propertyId > 0
      ? { action: "like", propertyId }
      : null;
  }

  if (customId.startsWith(DISLIKE_PREFIX)) {
    const propertyId = Number(customId.slice(DISLIKE_PREFIX.length));
    return Number.isInteger(propertyId) && propertyId > 0
      ? { action: "dislike", propertyId }
      : null;
  }

  return null;
}

export async function handleBrowseButton(
  interaction: ButtonInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  enrichmentQueue: EnrichmentQueue
): Promise<boolean> {
  const parsed = parseBrowseButtonCustomId(interaction.customId);
  if (!parsed) return false;

  const session = getBrowseSession(interaction.user.id);
  if (!session) {
    await interaction.reply({
      content: "This browse session expired. Run `/browse` again to continue.",
      flags: MessageFlagsBitField.Flags.Ephemeral,
    });
    return true;
  }

  await interaction.deferUpdate();

  if (parsed.action === "stop") {
    const reviewed = session.shownCount;
    clearBrowseSession(interaction.user.id);
    await interaction.editReply({
      content: `⏹️ Browse stopped — ${String(reviewed)} listing(s) reviewed.`,
      embeds: [],
      components: [],
    });
    return true;
  }

  const listing = await repository.findById(parsed.propertyId);
  if (!listing) {
    clearBrowseSession(interaction.user.id);
    await interaction.editReply({
      content: `Listing #${String(parsed.propertyId)} not found. Run \`/browse\` again.`,
      embeds: [],
      components: [],
    });
    return true;
  }

  await reactionRepository.add(parsed.propertyId, parsed.action);
  noteBrowseReaction(session, parsed.propertyId);

  const next = await buildBrowseReply(
    repository,
    reactionRepository,
    enrichmentQueue,
    interaction.user.id,
    session
  );
  await interaction.editReply(next);
  return true;
}

export { clearBrowseSession, getBrowseSession, startBrowseSession };
