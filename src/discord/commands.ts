import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ScraperService } from "../services/scraperService.js";
import { config } from "../config.js";
import { formatListing, formatListingEmbed } from "./format.js";
import { sendNewListingNotifications } from "./webhook.js";

export function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("annonces")
      .setDescription("Rechercher des annonces enregistrées")
      .addStringOption((opt) =>
        opt.setName("ville").setDescription("Filtrer par ville").setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("prix_max")
          .setDescription("Prix maximum en euros")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("surface_min")
          .setDescription("Surface minimum en m²")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("limite")
          .setDescription("Nombre de résultats (max 10)")
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("annonce")
      .setDescription("Afficher le détail d'une annonce")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("scraper")
      .setDescription("Lancer un scraping manuel")
      .addStringOption((opt) =>
        opt.setName("ville").setDescription("Ville à scraper").setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("prix_max")
          .setDescription("Prix maximum en euros")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Statistiques de la base d'annonces"),

    new SlashCommandBuilder()
      .setName("aide")
      .setDescription("Afficher l'aide du bot"),
  ].map((cmd) => cmd.toJSON());
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  repository: ListingRepository,
  scraperService: ScraperService,
  defaultScrapeOptions: { city: string; maxPrice: number; minSurface: number }
): Promise<void> {
  const { commandName } = interaction;

  switch (commandName) {
    case "annonces": {
      const city = interaction.options.getString("ville") ?? undefined;
      const maxPrice = interaction.options.getInteger("prix_max") ?? undefined;
      const minSurface =
        interaction.options.getInteger("surface_min") ?? undefined;
      const limit = interaction.options.getInteger("limite") ?? 5;

      const listings = await repository.search({
        city,
        maxPrice,
        minSurface,
        limit,
      });

      if (listings.length === 0) {
        await interaction.reply("Aucune annonce trouvée avec ces critères.");
        return;
      }

      const message = listings.map(formatListing).join("\n\n---\n\n");
      await interaction.reply(message.slice(0, 2000));
      return;
    }

    case "annonce": {
      const id = interaction.options.getInteger("id", true);
      const listing = await repository.findById(id);

      if (!listing) {
        await interaction.reply(`Annonce #${id} introuvable.`);
        return;
      }

      await interaction.reply({ embeds: [formatListingEmbed(listing)] });
      return;
    }

    case "scraper": {
      await interaction.deferReply();

      const city =
        interaction.options.getString("ville") ?? defaultScrapeOptions.city;
      const maxPrice =
        interaction.options.getInteger("prix_max") ??
        defaultScrapeOptions.maxPrice;

      const result = await scraperService.run({
        city,
        maxPrice,
        minSurface: defaultScrapeOptions.minSurface,
      });

      if (config.discord.webhookUrl && result.insertedListings.length > 0) {
        await sendNewListingNotifications(
          config.discord.webhookUrl,
          result.insertedListings
        );
      }

      await interaction.editReply(
        [
          `Scraping terminé pour **${city}**`,
          `📥 ${result.found} trouvées`,
          `✅ ${result.inserted} nouvelles`,
          `🔄 ${result.updated} mises à jour`,
          `⏭️ ${result.skipped} inchangées (pas de doublon)`,
          `📊 Total en base: **${await repository.count()}** annonces`,
        ].join("\n")
      );
      return;
    }

    case "stats": {
      const total = await repository.count();
      const recent = await repository.findRecent(3);

      const lines = [
        `📊 **${total}** annonces en base`,
        "",
        "**Dernières annonces:**",
        recent.length > 0
          ? recent.map((l) => `• #${l.id} — ${l.title} (${l.city})`).join("\n")
          : "_Aucune annonce pour le moment_",
      ];

      await interaction.reply(lines.join("\n"));
      return;
    }

    case "aide": {
      await interaction.reply(
        [
          "**Find My House** — Commandes disponibles:",
          "",
          "`/annonces` — Rechercher des annonces (ville, prix max, surface min)",
          "`/annonce id:123` — Détail d'une annonce",
          "`/scraper` — Lancer un scraping manuel",
          "`/stats` — Statistiques de la base",
          "`/aide` — Afficher cette aide",
        ].join("\n")
      );
      return;
    }

    default:
      await interaction.reply("Commande inconnue.");
  }
}
