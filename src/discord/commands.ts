import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScraperService } from "../services/scraperService.js";
import { config } from "../config.js";
import type { ScrapeFilters } from "../types/listing.js";
import { geoFilterLabel, resolveGeoFilter } from "../utils/geoFilter.js";
import { buildListingActionRow } from "./components.js";
import { formatListing, formatListingEmbed } from "./format.js";
import { sendNewListingNotifications } from "./notifications.js";

export function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName("annonces")
      .setDescription("Rechercher des annonces enregistrées")
      .addStringOption((opt) =>
        opt
          .setName("ville")
          .setDescription("Filtrer par ville")
          .setRequired(false)
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
          .setName("terrain_min")
          .setDescription("Terrain minimum en m²")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("pieces_min")
          .setDescription("Nombre de pièces minimum")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("chambres_min")
          .setDescription("Nombre de chambres minimum")
          .setRequired(false)
      )
      .addBooleanOption((opt) =>
        opt
          .setName("ancien")
          .setDescription("Uniquement les biens anciens (pas de neuf)")
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("rayon_km")
          .setDescription(
            "Rayon de recherche en kilomètres (nécessite une ville)"
          )
          .setMinValue(1)
          .setMaxValue(100)
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
      .setDescription(
        "Lancer un scraping avec les critères définis dans les variables d'environnement"
      ),

    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Statistiques de la base d'annonces"),

    new SlashCommandBuilder()
      .setName("aide")
      .setDescription("Afficher l'aide du bot"),

    new SlashCommandBuilder()
      .setName("jaime")
      .setDescription("Gérer vos annonces favorites")
      .addSubcommand((sub) =>
        sub
          .setName("ajouter")
          .setDescription("Ajouter une annonce à vos favoris")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("ID de l'annonce")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("retirer")
          .setDescription("Retirer une annonce de vos favoris")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("ID de l'annonce")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("liste")
          .setDescription("Afficher vos annonces favorites")
          .addIntegerOption((opt) =>
            opt
              .setName("limite")
              .setDescription("Nombre de résultats (max 10)")
              .setMinValue(1)
              .setMaxValue(10)
              .setRequired(false)
          )
      ),

    new SlashCommandBuilder()
      .setName("pas-jaime")
      .setDescription("Gérer les annonces que vous n'aimez pas")
      .addSubcommand((sub) =>
        sub
          .setName("ajouter")
          .setDescription("Marquer une annonce comme non aimée")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("ID de l'annonce")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("retirer")
          .setDescription("Retirer une annonce de vos non-favoris")
          .addIntegerOption((opt) =>
            opt
              .setName("id")
              .setDescription("ID de l'annonce")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("liste")
          .setDescription("Afficher les annonces que vous n'aimez pas")
          .addIntegerOption((opt) =>
            opt
              .setName("limite")
              .setDescription("Nombre de résultats (max 10)")
              .setMinValue(1)
              .setMaxValue(10)
              .setRequired(false)
          )
      ),
  ].map((cmd) => cmd.toJSON());
}

async function formatReactionList(
  reactionRepository: ReactionRepository,
  discordUserId: string,
  type: "like" | "dislike",
  limit: number,
  emptyLabel: string
): Promise<string> {
  const total = await reactionRepository.countByUser(discordUserId, type);
  const listings = await reactionRepository.findListingsByUser(
    discordUserId,
    type,
    limit
  );

  if (listings.length === 0) {
    return emptyLabel;
  }

  const header =
    total > limit
      ? `**${String(total)}** au total — ${String(listings.length)} affichées :`
      : `**${String(total)}** annonce${total > 1 ? "s" : ""} :`;

  return [header, "", listings.map(formatListing).join("\n\n---\n\n")].join(
    "\n"
  );
}

export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  scraperService: ScraperService,
  defaultScrapeOptions: ScrapeFilters
): Promise<void> {
  const { commandName } = interaction;

  switch (commandName) {
    case "annonces": {
      const city = interaction.options.getString("ville") ?? undefined;
      const maxPrice = interaction.options.getInteger("prix_max") ?? undefined;
      const minSurface =
        interaction.options.getInteger("surface_min") ?? undefined;
      const minLandSurface =
        interaction.options.getInteger("terrain_min") ?? undefined;
      const minRooms =
        interaction.options.getInteger("pieces_min") ?? undefined;
      const minBedrooms =
        interaction.options.getInteger("chambres_min") ?? undefined;
      const ancienOnly = interaction.options.getBoolean("ancien") ?? undefined;
      const radiusKm = interaction.options.getInteger("rayon_km") ?? undefined;
      const maxTravelMinutes =
        radiusKm === undefined
          ? defaultScrapeOptions.maxTravelMinutes
          : undefined;
      const limit = interaction.options.getInteger("limite") ?? 5;
      const geoFilter = resolveGeoFilter({ maxTravelMinutes, radiusKm }, true);

      if (geoFilter.mode !== "city" && !city) {
        await interaction.reply(
          "Pour un filtre géographique, précisez une **ville**."
        );
        return;
      }

      const listings = await repository.search({
        city,
        maxPrice,
        minSurface,
        minLandSurface,
        minRooms,
        minBedrooms,
        ancienOnly,
        maxTravelMinutes,
        radiusKm,
        limit,
      });

      if (listings.length === 0) {
        await interaction.reply(
          geoFilter.mode !== "city"
            ? `Aucune annonce trouvée dans cette zone (${geoFilterLabel(geoFilter)}).`
            : "Aucune annonce trouvée avec ces critères."
        );
        return;
      }

      await interaction.reply({
        embeds: [formatListingEmbed(listings[0])],
        components: [buildListingActionRow(listings[0].id)],
      });

      for (const listing of listings.slice(1)) {
        await interaction.followUp({
          embeds: [formatListingEmbed(listing)],
          components: [buildListingActionRow(listing.id)],
        });
      }
      return;
    }

    case "annonce": {
      const id = interaction.options.getInteger("id", true);
      const listing = await repository.findById(id);

      if (!listing) {
        await interaction.reply(`Annonce #${String(id)} introuvable.`);
        return;
      }

      await interaction.reply({
        embeds: [formatListingEmbed(listing)],
        components: [buildListingActionRow(listing.id)],
      });
      return;
    }

    case "scraper": {
      await interaction.deferReply();

      const { city, radiusKm, maxTravelMinutes } = defaultScrapeOptions;
      const result = await scraperService.run(defaultScrapeOptions);

      if (config.discord.channelId && result.insertedListings.length > 0) {
        await sendNewListingNotifications(
          config.discord.token,
          config.discord.channelId,
          result.insertedListings
        );
      }

      const scrapeGeoFilter = resolveGeoFilter(
        { maxTravelMinutes, radiusKm },
        true
      );
      const zoneLabel =
        scrapeGeoFilter.mode === "city"
          ? ""
          : ` (${geoFilterLabel(scrapeGeoFilter)})`;

      await interaction.editReply(
        [
          `Scraping terminé pour **${city}**${zoneLabel}`,
          `📥 ${String(result.found)} trouvées`,
          `✅ ${String(result.inserted)} nouvelles`,
          `🔄 ${String(result.updated)} mises à jour`,
          `⏭️ ${String(result.skipped)} inchangées (pas de doublon)`,
          `📊 Total en base: **${String(await repository.count())}** annonces`,
        ].join("\n")
      );
      return;
    }

    case "stats": {
      const total = await repository.count();
      const recent = await repository.findRecent(3);

      const lines = [
        `📊 **${String(total)}** annonces en base`,
        "",
        "**Dernières annonces:**",
        recent.length > 0
          ? recent
              .map((l) => `• #${String(l.id)} — ${l.title} (${l.city})`)
              .join("\n")
          : "_Aucune annonce pour le moment_",
      ];

      await interaction.reply(lines.join("\n"));
      return;
    }

    case "jaime": {
      const subcommand = interaction.options.getSubcommand();
      const discordUserId = interaction.user.id;

      if (subcommand === "liste") {
        const limit = interaction.options.getInteger("limite") ?? 5;
        const message = await formatReactionList(
          reactionRepository,
          discordUserId,
          "like",
          limit,
          "Vous n'avez aucune annonce en favori."
        );
        await interaction.reply(message.slice(0, 2000));
        return;
      }

      const id = interaction.options.getInteger("id", true);
      const listing = await repository.findById(id);

      if (!listing) {
        await interaction.reply(`Annonce #${String(id)} introuvable.`);
        return;
      }

      if (subcommand === "ajouter") {
        const result = await reactionRepository.add(discordUserId, id, "like");
        await interaction.reply(
          result === "already_exists"
            ? `L'annonce **#${String(id)}** est déjà dans vos favoris.`
            : `❤️ Annonce **#${String(id)}** ajoutée à vos favoris.`
        );
        return;
      }

      const removed = await reactionRepository.remove(
        discordUserId,
        id,
        "like"
      );
      await interaction.reply(
        removed
          ? `Annonce **#${String(id)}** retirée de vos favoris.`
          : `L'annonce **#${String(id)}** n'était pas dans vos favoris.`
      );
      return;
    }

    case "pas-jaime": {
      const subcommand = interaction.options.getSubcommand();
      const discordUserId = interaction.user.id;

      if (subcommand === "liste") {
        const limit = interaction.options.getInteger("limite") ?? 5;
        const message = await formatReactionList(
          reactionRepository,
          discordUserId,
          "dislike",
          limit,
          "Vous n'avez marqué aucune annonce comme non aimée."
        );
        await interaction.reply(message.slice(0, 2000));
        return;
      }

      const id = interaction.options.getInteger("id", true);
      const listing = await repository.findById(id);

      if (!listing) {
        await interaction.reply(`Annonce #${String(id)} introuvable.`);
        return;
      }

      if (subcommand === "ajouter") {
        const result = await reactionRepository.add(
          discordUserId,
          id,
          "dislike"
        );
        await interaction.reply(
          result === "already_exists"
            ? `L'annonce **#${String(id)}** est déjà dans vos non-favoris.`
            : `👎 Annonce **#${String(id)}** ajoutée à vos non-favoris.`
        );
        return;
      }

      const removed = await reactionRepository.remove(
        discordUserId,
        id,
        "dislike"
      );
      await interaction.reply(
        removed
          ? `Annonce **#${String(id)}** retirée de vos non-favoris.`
          : `L'annonce **#${String(id)}** n'était pas dans vos non-favoris.`
      );
      return;
    }

    case "aide": {
      await interaction.reply(
        [
          "**Find My House** — Commandes disponibles:",
          "",
          "`/annonces` — Rechercher (prix, terrain, pièces, chambres, ancien, rayon km…)",
          "`/annonce id:123` — Détail d'une annonce (boutons ❤️ / 👎)",
          "`/jaime ajouter|retirer|liste` — Gérer vos favoris",
          "`/pas-jaime ajouter|retirer|liste` — Gérer vos non-favoris",
          "_Cliquez sur ❤️ ou 👎 sous une annonce pour l'ajouter ou la retirer._",
          "`/scraper` — Lancer un scraping (critères définis dans le .env)",
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
