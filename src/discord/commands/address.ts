import { SlashCommandBuilder } from "discord.js";
import { ensurePropertyEnriched } from "../../services/enrichmentService.js";
import { searchDpeForProperty } from "../../utils/energy/ademeDpeApi.js";
import { createLogger } from "../../utils/logger.js";
import { buildDpeCandidateComponents } from "../dpeComponents.js";
import { formatDpePropertySearchReply } from "../dpeFormat.js";
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

  const { property, warnings } = await ensurePropertyEnriched(
    ctx.repository,
    id,
    "address"
  );
  if (!property) {
    await interaction.editReply(`Listing #${String(id)} not found.`);
    return;
  }

  try {
    const { query, candidates } = await searchDpeForProperty(property);
    const warningNote =
      warnings.length > 0 ? `\n\n_${warnings.join(" — ")}_` : "";
    const content = (
      formatDpePropertySearchReply(property, query, candidates) + warningNote
    ).slice(0, 2000);

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
