import type { ChatInputCommandInteraction } from "discord.js";
import type { ListingRepository } from "../../db/listingRepository.js";
import type { ReactionRepository } from "../../db/reactionRepository.js";
import type { ScraperService } from "../../services/scraperService.js";
import type {
  ExtendedScrapeResult,
  ScrapeFilters,
} from "../../types/listing.js";
import type { DiscordCommandSettings } from "./types.js";
import { buildAdresseCommand, handleAdresse } from "./adresse.js";
import { buildAideCommand, handleAide } from "./aide.js";
import { buildAnnonceCommand, handleAnnonce } from "./annonce.js";
import { buildAnnoncesCommand, handleAnnonces } from "./annonces.js";
import { buildJaimeCommand, handleJaime } from "./jaime.js";
import { buildPasJaimeCommand, handlePasJaime } from "./pas-jaime.js";
import { buildScraperCommand, handleScraper } from "./scraper.js";
import { buildStatsCommand, handleStats } from "./stats.js";
import type { CommandContext } from "./types.js";
import { buildVersionCommand, handleVersion } from "./version.js";

export function buildCommands() {
  return [
    buildAnnoncesCommand(),
    buildAnnonceCommand(),
    buildScraperCommand(),
    buildStatsCommand(),
    buildVersionCommand(),
    buildAdresseCommand(),
    buildAideCommand(),
    buildJaimeCommand(),
    buildPasJaimeCommand(),
  ].map((cmd) => cmd.toJSON());
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  scraperService: ScraperService,
  defaultScrapeOptions: ScrapeFilters,
  discord: DiscordCommandSettings,
  notifyScrapeResults: (result: ExtendedScrapeResult) => Promise<void>
): Promise<void> {
  const ctx: CommandContext = {
    repository,
    reactionRepository,
    scraperService,
    defaultScrapeOptions,
    discord,
    notifyScrapeResults,
  };

  switch (interaction.commandName) {
    case "annonces":
      await handleAnnonces(interaction, ctx);
      return;
    case "annonce":
      await handleAnnonce(interaction, ctx);
      return;
    case "scraper":
      await handleScraper(interaction, ctx);
      return;
    case "stats":
      await handleStats(interaction, ctx);
      return;
    case "jaime":
      await handleJaime(interaction, ctx);
      return;
    case "pas-jaime":
      await handlePasJaime(interaction, ctx);
      return;
    case "version":
      await handleVersion(interaction, ctx);
      return;
    case "adresse":
      await handleAdresse(interaction, ctx);
      return;
    case "aide":
      await handleAide(interaction, ctx);
      return;
    default:
      await interaction.reply("Commande inconnue.");
  }
}
