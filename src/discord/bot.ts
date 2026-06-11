import { REST } from "@discordjs/rest";
import { GatewayIntentBits } from "discord-api-types/gateway/v10";
import { Client, Events } from "discord.js";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ScraperService } from "../services/scraperService.js";
import type { ScrapeFilters } from "../types/listing.js";
import { buildCommands, handleCommand } from "./commands.js";

interface BotOptions {
  token: string;
  clientId: string;
  guildId?: string;
  repository: ListingRepository;
  scraperService: ScraperService;
  scrapeDefaults: ScrapeFilters;
}

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

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      await handleCommand(
        interaction,
        options.repository,
        options.scraperService,
        options.scrapeDefaults
      );
    } catch (error) {
      console.error("[discord] Erreur commande:", error);
      const reply = { content: "Une erreur est survenue.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  await client.login(options.token);
  return client;
}
