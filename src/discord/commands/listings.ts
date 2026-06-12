import { SlashCommandBuilder } from "discord.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geo/geoFilter.js";
import { parseListingSource } from "../../utils/listingValidation.js";
import { buildListingActionRow } from "../components.js";
import { formatListingEmbed } from "../format.js";
import type { CommandHandler } from "./types.js";

export function buildListingsCommand() {
  return new SlashCommandBuilder()
    .setName("listings")
    .setDescription("Rechercher des annonces enregistrées")
    .addStringOption((opt) =>
      opt.setName("city").setDescription("Filtrer par ville").setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("postal_code")
        .setDescription("Filtrer par code postal")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("Rechercher dans le titre ou la description")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("source")
        .setDescription("Filtrer par portail")
        .setRequired(false)
        .addChoices(
          { name: "Bien'ici", value: "bienici" },
          { name: "SeLoger", value: "seloger" },
          { name: "Leboncoin", value: "leboncoin" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_price")
        .setDescription("Prix minimum en euros")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("max_price")
        .setDescription("Prix maximum en euros")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_surface")
        .setDescription("Surface minimum en m²")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_land")
        .setDescription("Terrain minimum en m²")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_rooms")
        .setDescription("Nombre de pièces minimum")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_bedrooms")
        .setDescription("Nombre de chambres minimum")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("old_only")
        .setDescription("Uniquement les biens anciens (pas de neuf)")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("new_only")
        .setDescription("Uniquement les biens neufs")
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
        .setName("travel_minutes")
        .setDescription(
          "Temps de trajet max en voiture, en minutes (nécessite une ville)"
        )
        .setMinValue(5)
        .setMaxValue(120)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("sort")
        .setDescription("Ordre des résultats")
        .setRequired(false)
        .addChoices(
          { name: "Prix croissant", value: "price_asc" },
          { name: "Prix décroissant", value: "price_desc" },
          { name: "Plus récentes", value: "date_desc" },
          { name: "Surface décroissante", value: "surface_desc" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Nombre de résultats (max 10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    );
}

export const handleListings: CommandHandler = async (interaction, ctx) => {
  const city = interaction.options.getString("city") ?? undefined;
  const postalCode = interaction.options.getString("postal_code") ?? undefined;
  const text = interaction.options.getString("text") ?? undefined;
  const sourceOption = interaction.options.getString("source");
  const source = sourceOption
    ? (parseListingSource(sourceOption) ?? undefined)
    : undefined;
  const minPrice = interaction.options.getInteger("min_price") ?? undefined;
  const maxPrice = interaction.options.getInteger("max_price") ?? undefined;
  const minSurface = interaction.options.getInteger("min_surface") ?? undefined;
  const minLandSurface =
    interaction.options.getInteger("min_land") ?? undefined;
  const minRooms = interaction.options.getInteger("min_rooms") ?? undefined;
  const minBedrooms =
    interaction.options.getInteger("min_bedrooms") ?? undefined;
  const ancienOnly = interaction.options.getBoolean("old_only") ?? undefined;
  const neufOnly = interaction.options.getBoolean("new_only") ?? undefined;
  const radiusKm = interaction.options.getInteger("rayon_km") ?? undefined;
  const maxTravelMinutes =
    interaction.options.getInteger("travel_minutes") ?? undefined;
  const sort =
    (interaction.options.getString("sort") as
      | "price_asc"
      | "price_desc"
      | "date_desc"
      | "surface_desc"
      | null) ?? undefined;
  const limit = interaction.options.getInteger("limit") ?? 5;
  const geoFilter = resolveGeoFilter({ maxTravelMinutes, radiusKm }, true);

  if (ancienOnly && neufOnly) {
    await interaction.reply("Les filtres ancien et neuf sont incompatibles.");
    return;
  }

  if (geoFilter.mode !== "city" && !city) {
    await interaction.reply("Pour un filtre géographique, précisez une ville.");
    return;
  }

  await interaction.deferReply();

  const listings = await ctx.repository.search({
    city,
    postalCode,
    text,
    source,
    minPrice,
    maxPrice,
    minSurface,
    minLandSurface,
    minRooms,
    minBedrooms,
    ancienOnly,
    neufOnly,
    maxTravelMinutes,
    radiusKm,
    sort,
    limit,
  });

  if (listings.length === 0) {
    await interaction.editReply(
      geoFilter.mode !== "city"
        ? `Aucune annonce trouvée dans cette zone (${geoFilterLabel(geoFilter)}).`
        : "Aucune annonce trouvée avec ces critères."
    );
    return;
  }

  const resultHeader =
    listings.length === 1
      ? "📋 **1 annonce** trouvée"
      : `📋 **${String(listings.length)} annonces** trouvées`;

  await interaction.editReply({
    content: resultHeader,
    embeds: [formatListingEmbed(listings[0])],
    components: [buildListingActionRow(listings[0].id)],
  });

  for (const listing of listings.slice(1)) {
    await interaction.followUp({
      embeds: [formatListingEmbed(listing)],
      components: [buildListingActionRow(listing.id)],
    });
  }
};
