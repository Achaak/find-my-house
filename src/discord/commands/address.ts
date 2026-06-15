import { SlashCommandBuilder } from "discord.js";
import { searchDpeForProperty } from "../../utils/energy/ademeDpeApi.js";
import { getDpeAddressSearchReadiness } from "../../utils/energy/dpePropertyMatch.js";
import { createLogger } from "../../utils/logger.js";
import { buildDpeCandidateComponents } from "../dpeComponents.js";
import {
  formatDpePropertySearchReply,
  formatDpeSearchUnavailableReply,
} from "../dpeFormat.js";
import type { CommandHandler } from "./types.js";

const log = createLogger("discord");

export function buildAddressCommand() {
  return new SlashCommandBuilder()
    .setName("address")
    .setDescription("Identify a listing address via ADEME public DPE data")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Listing ID to locate").setRequired(true)
    );
}

export const handleAddress: CommandHandler = async (interaction, ctx) => {
  const id = interaction.options.getInteger("id", true);
  await interaction.deferReply();

  const { warnings: enrichmentWarnings } =
    await ctx.enrichmentQueue.waitUntilEnriched(id, "address", "high");
  const property = await ctx.repository.findById(id);
  if (!property) {
    await interaction.editReply(`Listing #${String(id)} not found.`);
    return;
  }

  if (getDpeAddressSearchReadiness(property) === "unavailable") {
    const warningNote =
      enrichmentWarnings.length > 0
        ? `\n\n_${enrichmentWarnings.join(" — ")}_`
        : "";
    await interaction.editReply(
      (formatDpeSearchUnavailableReply(property) + warningNote).slice(0, 2000)
    );
    return;
  }

  try {
    const {
      query,
      candidates,
      readiness,
      warnings: searchWarnings,
    } = await searchDpeForProperty(property);
    const warnings = [...enrichmentWarnings, ...searchWarnings];
    const content = formatDpePropertySearchReply(property, query, candidates, {
      readiness,
      warnings,
    }).slice(0, 2000);

    if (candidates.length === 0) {
      await interaction.editReply(content);
      return;
    }

    await interaction.editReply({
      content,
      components: buildDpeCandidateComponents(property.id, candidates),
    });
  } catch (error) {
    log.error("DPE search error:", error);
    await interaction.editReply(
      "Unable to reach the ADEME API right now. Try again later."
    );
  }
};
