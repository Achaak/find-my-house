import { SlashCommandBuilder } from "discord.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geoFilter.js";
import { buildListingActionRow } from "../components.js";
import { formatListingEmbed } from "../format.js";
import type { CommandHandler } from "./types.js";

export function buildAnnoncesCommand() {
  return new SlashCommandBuilder()
    .setName("annonces")
    .setDescription("Rechercher des annonces enregistrées")
    .addStringOption((opt) =>
      opt
        .setName("ville")
        .setDescription("Filtrer par ville")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("code_postal")
        .setDescription("Filtrer par code postal")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("texte")
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
        .setName("prix_min")
        .setDescription("Prix minimum en euros")
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
    .addBooleanOption((opt) =>
      opt
        .setName("neuf")
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
        .setName("temps_trajet")
        .setDescription(
          "Temps de trajet max en voiture, en minutes (nécessite une ville)"
        )
        .setMinValue(5)
        .setMaxValue(120)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("tri")
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
        .setName("limite")
        .setDescription("Nombre de résultats (max 10)")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    );
}

export const handleAnnonces: CommandHandler = async (interaction, ctx) => {
  const city = interaction.options.getString("ville") ?? undefined;
  const postalCode = interaction.options.getString("code_postal") ?? undefined;
  const text = interaction.options.getString("texte") ?? undefined;
  const source =
    (interaction.options.getString("source") as
      | "bienici"
      | "seloger"
      | "leboncoin"
      | null) ?? undefined;
  const minPrice = interaction.options.getInteger("prix_min") ?? undefined;
  const maxPrice = interaction.options.getInteger("prix_max") ?? undefined;
  const minSurface = interaction.options.getInteger("surface_min") ?? undefined;
  const minLandSurface =
    interaction.options.getInteger("terrain_min") ?? undefined;
  const minRooms = interaction.options.getInteger("pieces_min") ?? undefined;
  const minBedrooms =
    interaction.options.getInteger("chambres_min") ?? undefined;
  const ancienOnly = interaction.options.getBoolean("ancien") ?? undefined;
  const neufOnly = interaction.options.getBoolean("neuf") ?? undefined;
  const radiusKm = interaction.options.getInteger("rayon_km") ?? undefined;
  const maxTravelMinutes =
    interaction.options.getInteger("temps_trajet") ?? undefined;
  const sort =
    (interaction.options.getString("tri") as
      | "price_asc"
      | "price_desc"
      | "date_desc"
      | "surface_desc"
      | null) ?? undefined;
  const limit = interaction.options.getInteger("limite") ?? 5;
  const geoFilter = resolveGeoFilter({ maxTravelMinutes, radiusKm }, true);

  if (ancienOnly && neufOnly) {
    await interaction.reply(
      "Les options **ancien** et **neuf** sont incompatibles."
    );
    return;
  }

  if (geoFilter.mode !== "city" && !city) {
    await interaction.reply(
      "Pour un filtre géographique, précisez une **ville**."
    );
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

  await interaction.editReply({
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
