import type { ChatInputCommandInteraction } from "discord.js";
import type { EnrichmentQueue } from "../../services/enrichmentQueue.js";
import type { ListingRepository } from "../../db/listingRepository.js";
import type { ReactionRepository } from "../../db/reactionRepository.js";
import type { ScraperService } from "../../services/scraperService.js";
import type {
  ExtendedScrapeResult,
  ScrapeFilters,
} from "../../types/listing.js";
import { buildAddressCommand, handleAddress } from "./address.js";
import { buildBrowseCommand, handleBrowse } from "./browse.js";
import { buildDislikeCommand, handleDislike } from "./dislike.js";
import { buildHelpCommand, handleHelp } from "./help.js";
import { buildLikeCommand, handleLike } from "./like.js";
import { buildListingCommand, handleListing } from "./listing.js";
import { buildListingsCommand, handleListings } from "./listings.js";
import { buildReconcileCommand, handleReconcile } from "./reconcile.js";
import { buildScraperCommand, handleScraper } from "./scraper.js";
import { buildStatsCommand, handleStats } from "./stats.js";
import type { CommandContext, DiscordCommandSettings } from "./types.js";
import { buildVersionCommand, handleVersion } from "./version.js";

export function buildCommands() {
  return [
    buildListingsCommand(),
    buildListingCommand(),
    buildBrowseCommand(),
    buildScraperCommand(),
    buildReconcileCommand(),
    buildStatsCommand(),
    buildVersionCommand(),
    buildAddressCommand(),
    buildHelpCommand(),
    buildLikeCommand(),
    buildDislikeCommand(),
  ].map((cmd) => cmd.toJSON());
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  scraperService: ScraperService,
  enrichmentQueue: EnrichmentQueue,
  defaultScrapeOptions: ScrapeFilters,
  discord: DiscordCommandSettings,
  notifyScrapeResults: (result: ExtendedScrapeResult) => Promise<void>
): Promise<void> {
  const ctx: CommandContext = {
    repository,
    reactionRepository,
    scraperService,
    enrichmentQueue,
    defaultScrapeOptions,
    discord,
    notifyScrapeResults,
  };

  switch (interaction.commandName) {
    case "listings":
      await handleListings(interaction, ctx);
      return;
    case "listing":
      await handleListing(interaction, ctx);
      return;
    case "browse":
      await handleBrowse(interaction, ctx);
      return;
    case "scraper":
      await handleScraper(interaction, ctx);
      return;
    case "reconcile":
      await handleReconcile(interaction, ctx);
      return;
    case "stats":
      await handleStats(interaction, ctx);
      return;
    case "like":
      await handleLike(interaction, ctx);
      return;
    case "dislike":
      await handleDislike(interaction, ctx);
      return;
    case "version":
      await handleVersion(interaction, ctx);
      return;
    case "address":
      await handleAddress(interaction, ctx);
      return;
    case "help":
      await handleHelp(interaction, ctx);
      return;
    default:
      await interaction.reply("Commande inconnue.");
  }
}
