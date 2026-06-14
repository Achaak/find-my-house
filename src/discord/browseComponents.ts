import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  MessageFlagsBitField,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import {
  clearBrowseSession,
  getBrowseSession,
  pickNextBrowseListing,
  startBrowseSession,
  type BrowseSession,
} from "../services/browseSession.js";
import {
  formatListingEmbedWithCompatibility,
  resetListingCompatibilityCache,
  resolveListingCompatibilityPreferences,
} from "./listingEmbed.js";

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
  const preferences = await resolveListingCompatibilityPreferences(
    reactionRepository,
    discordUserId
  );
  const pick = await pickNextBrowseListing(
    repository,
    reactionRepository,
    discordUserId,
    session,
    preferences
  );

  if (!pick) {
    clearBrowseSession(discordUserId);
    return {
      content:
        "✅ No more listings to browse with your current criteria.\n" +
        "Use `/listings` to broaden your search or wait for new listings.",
      embeds: [],
      components: [],
    };
  }

  const embed = await formatListingEmbedWithCompatibility(
    pick.property,
    reactionRepository,
    discordUserId
  );

  return {
    content: browseHeader({
      shownCount: session.shownCount,
      isExplore: pick.isExplore,
      hasPreferences: preferences !== null,
    }),
    embeds: [embed],
    components: [buildBrowseActionRow(pick.property.id)],
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
  reactionRepository: ReactionRepository
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

  await reactionRepository.add(
    interaction.user.id,
    parsed.propertyId,
    parsed.action
  );
  resetListingCompatibilityCache();

  const next = await buildBrowseReply(
    repository,
    reactionRepository,
    interaction.user.id,
    session
  );
  await interaction.editReply(next);
  return true;
}

export { clearBrowseSession, getBrowseSession, startBrowseSession };
