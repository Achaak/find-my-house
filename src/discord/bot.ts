import { REST } from "@discordjs/rest";
import { GatewayIntentBits } from "discord-api-types/gateway/v10";
import { Client, Events } from "discord.js";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScraperService } from "../services/scraperService.js";
import type { ScrapeFilters } from "../types/listing.js";
import { buildCommands, handleCommand } from "./commands.js";
import { handleListingButton } from "./components.js";

type BotOptions = {
  token: string;
  clientId: string;
  guildId?: string;
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  scraperService: ScraperService;
  scrapeDefaults: ScrapeFilters;
};

export async function startDiscordBot(options: BotOptions): Promise<Client> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const rest = new REST({ version: "10" }).setToken(options.token);
  const commands = buildCommands();

  if (options.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(options.clientId, options.guildId),
      { body: commands }
    );
    console.log("[discord] Commandes enregistrées sur le serveur de dev");
  } else {
    await rest.put(Routes.applicationCommands(options.clientId), {
      body: commands,
    });
    console.log("[discord] Commandes enregistrées globalement");
  }

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[discord] Connecté en tant que ${readyClient.user.tag}`);
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
            options.scrapeDefaults
          );
          return;
        }

        if (interaction.isButton()) {
          await handleListingButton(
            interaction,
            options.repository,
            options.reactionRepository
          );
        }
      } catch (error) {
        console.error("[discord] Erreur interaction:", error);
        if (!interaction.isRepliable()) return;

        const reply = { content: "Une erreur est survenue.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    })();
  });

  await client.login(options.token);
  return client;
}
