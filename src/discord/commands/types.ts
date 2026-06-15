import type { ChatInputCommandInteraction } from "discord.js";
import type { ListingRepository } from "../../db/listingRepository.js";
import type { ReactionRepository } from "../../db/reactionRepository.js";
import type { EnrichmentQueue } from "../../services/enrichmentQueue.js";
import type { ScraperService } from "../../services/scraperService.js";
import type {
  ExtendedScrapeResult,
  ScrapeFilters,
} from "../../types/listing.js";

export type DiscordCommandSettings = {
  token: string;
  channelId?: string;
  adminRoleId?: string;
  maxNotifications?: number;
};

export type CommandContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  scraperService: ScraperService;
  enrichmentQueue: EnrichmentQueue;
  defaultScrapeOptions: ScrapeFilters;
  discord: DiscordCommandSettings;
  notifyScrapeResults: (result: ExtendedScrapeResult) => Promise<void>;
};

export type CommandHandler = (
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext
) => Promise<void>;
