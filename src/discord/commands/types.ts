import type { ChatInputCommandInteraction } from "discord.js";
import type { ListingRepository } from "../../db/listingRepository.js";
import type { ReactionRepository } from "../../db/reactionRepository.js";
import type { ScraperService } from "../../services/scraperService.js";
import type { ScrapeFilters } from "../../types/listing.js";

export type CommandContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  scraperService: ScraperService;
  defaultScrapeOptions: ScrapeFilters;
};

export type CommandHandler = (
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext
) => Promise<void>;
