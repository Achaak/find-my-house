import { REST } from "@discordjs/rest";
import { GatewayIntentBits } from "discord-api-types/gateway/v10";
import {
  Client,
  Events,
  MessageFlagsBitField,
  type InteractionReplyOptions,
} from "discord.js";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScraperService } from "../services/scraperService.js";
import { notifyScrapeResults } from "../services/notifyScrapeResults.js";
import type { ExtendedScrapeResult, ScrapeFilters } from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import { buildCommands, handleCommand } from "./commands/index.js";
import type { DiscordCommandSettings } from "./commands/types.js";
import { handleBrowseButton } from "./browseComponents.js";
import { handleListingButton } from "./components.js";
import { handleDpeButton } from "./dpeComponents.js";

const log = createLogger("discord");

type BotOptions = {
  discord: DiscordCommandSettings;
  clientId: string;
  guildId?: string;
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  scraperService: ScraperService;
  scrapeDefaults: ScrapeFilters;
};

export async function startDiscordBot(options: BotOptions): Promise<Client> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const rest = new REST({ version: "10" }).setToken(options.discord.token);
  const commands = buildCommands();
  const sendScrapeNotifications = async (
    result: ExtendedScrapeResult
  ): Promise<void> => {
    await notifyScrapeResults(result, {
      token: options.discord.token,
      channelId: options.discord.channelId,
      maxNotifications: options.discord.maxNotifications,
      reactionRepository: options.reactionRepository,
    });
  };

  if (options.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(options.clientId, options.guildId),
      { body: commands }
    );
    log.info("Commandes enregistrées sur le serveur de dev");
  } else {
    await rest.put(Routes.applicationCommands(options.clientId), {
      body: commands,
    });
    log.info("Commandes enregistrées globalement");
  }

  client.once(Events.ClientReady, (readyClient) => {
    log.info(`Connecté en tant que ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void (async () => {
      try {
        if (interaction.isChatInputCommand()) {
          await handleCommand(
            interaction,
            options.repository,
            options.reactionRepository,
            options.scraperService,
            options.scrapeDefaults,
            options.discord,
            sendScrapeNotifications
          );
          return;
        }

        if (interaction.isButton()) {
          const handled =
            (await handleBrowseButton(
              interaction,
              options.repository,
              options.reactionRepository
            )) ||
            (await handleListingButton(
              interaction,
              options.repository,
              options.reactionRepository
            )) ||
            (await handleDpeButton(interaction, options.repository));
          if (!handled) {
            log.warn(`Bouton non géré : ${interaction.customId}`);
          }
        }
      } catch (error) {
        log.error("Erreur interaction:", error);
        if (!interaction.isRepliable()) return;

        const reply: InteractionReplyOptions = {
          content: "Une erreur est survenue.",
          flags: MessageFlagsBitField.Flags.Ephemeral,
        };
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          log.error("Impossible de répondre à l'interaction:", replyError);
        }
      }
    })();
  });

  await client.login(options.discord.token);
  return client;
}
