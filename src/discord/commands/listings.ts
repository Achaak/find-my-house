import { SlashCommandBuilder } from "discord.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geo/geoFilter.js";
import { parseListingSource } from "../../utils/listingValidation.js";
import { sortByCompatibility } from "../../utils/compatibility/score.js";
import { buildListingActionRow } from "../components.js";
import {
  formatListingEmbedWithCompatibility,
  resolveListingCompatibilityPreferences,
} from "../listingEmbed.js";
import type { CommandHandler } from "./types.js";

export function buildListingsCommand() {
  return new SlashCommandBuilder()
    .setName("listings")
    .setDescription("Search saved listings")
    .addStringOption((opt) =>
      opt.setName("city").setDescription("Filter by city").setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("postal_code")
        .setDescription("Filter by postal code")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("text")
        .setDescription("Search in title or description")
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("source")
        .setDescription("Filter by portal")
        .setRequired(false)
        .addChoices(
          { name: "Bien'ici", value: "bienici" },
          { name: "SeLoger", value: "seloger" },
          { name: "Leboncoin", value: "leboncoin" },
          { name: "Logic-Immo", value: "logicimmo" }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_price")
        .setDescription("Minimum price in euros")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("max_price")
        .setDescription("Maximum price in euros")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_surface")
        .setDescription("Minimum surface area in m²")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_land")
        .setDescription("Minimum land area in m²")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_rooms")
        .setDescription("Minimum number of rooms")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("min_bedrooms")
        .setDescription("Minimum number of bedrooms")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("old_only")
        .setDescription("Existing builds only (exclude new builds)")
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("new_only")
        .setDescription("New builds only")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("travel_minutes")
        .setDescription("Max driving time in minutes (requires a city)")
        .setMinValue(5)
        .setMaxValue(120)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("sort")
        .setDescription("Result sort order")
        .setRequired(false)
        .addChoices(
          { name: "Price ascending", value: "price_asc" },
          { name: "Price descending", value: "price_desc" },
          { name: "Most recent", value: "date_desc" },
          { name: "Surface descending", value: "surface_desc" },
          {
            name: "Compatibility descending",
            value: "compat_desc",
          }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Number of results (max 10)")
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
  const maxTravelMinutes =
    interaction.options.getInteger("travel_minutes") ?? undefined;
  const sort =
    (interaction.options.getString("sort") as
      | "price_asc"
      | "price_desc"
      | "date_desc"
      | "surface_desc"
      | "compat_desc"
      | null) ?? undefined;
  const limit = interaction.options.getInteger("limit") ?? 5;
  const geoFilter = resolveGeoFilter({ maxTravelMinutes }, true);

  if (ancienOnly && neufOnly) {
    await interaction.reply(
      "Old and new build filters are mutually exclusive."
    );
    return;
  }

  if (geoFilter.mode !== "city" && !city) {
    await interaction.reply("Specify a city for a geographic filter.");
    return;
  }

  await interaction.deferReply();

  const { items: listings } = await ctx.repository.search({
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
    sort: sort === "compat_desc" ? undefined : sort,
    limit: sort === "compat_desc" ? Math.max(limit, 50) : limit,
  });

  const compatibilityPreferences = await resolveListingCompatibilityPreferences(
    ctx.reactionRepository,
    interaction.user.id
  );

  const rankedListings =
    sort === "compat_desc"
      ? sortByCompatibility(listings, compatibilityPreferences).slice(0, limit)
      : listings;

  if (rankedListings.length === 0) {
    await interaction.editReply(
      geoFilter.mode !== "city"
        ? `No listings found in this area (${geoFilterLabel(geoFilter)}).`
        : "No listings found matching these criteria."
    );
    return;
  }

  const compatibilityHint =
    sort === "compat_desc" && !compatibilityPreferences
      ? "\n_Like listings to enable compatibility sorting._"
      : "";
  const resultHeader =
    (rankedListings.length === 1
      ? "📋 **1 listing** found"
      : `📋 **${String(rankedListings.length)} listings** found`) +
    compatibilityHint;

  await interaction.editReply({
    content: resultHeader,
    embeds: [
      await formatListingEmbedWithCompatibility(
        rankedListings[0],
        ctx.reactionRepository,
        interaction.user.id
      ),
    ],
    components: [buildListingActionRow(rankedListings[0].id)],
  });

  for (const listing of rankedListings.slice(1)) {
    await interaction.followUp({
      embeds: [
        await formatListingEmbedWithCompatibility(
          listing,
          ctx.reactionRepository,
          interaction.user.id
        ),
      ],
      components: [buildListingActionRow(listing.id)],
    });
  }
};
