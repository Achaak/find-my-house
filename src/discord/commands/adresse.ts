import { SlashCommandBuilder } from "discord.js";
import { ensurePropertyEnriched } from "../../services/enrichmentService.js";
import { searchDpeForProperty } from "../../utils/energy/ademeDpeApi.js";
import { buildDpeCandidateComponents } from "../dpeComponents.js";
import { formatDpePropertySearchReply } from "../dpeFormat.js";
import type { CommandHandler } from "./types.js";

export function buildAdresseCommand() {
  return new SlashCommandBuilder()
    .setName("adresse")
    .setDescription(
      "Identifier l'adresse d'une annonce via les données DPE publiques ADEME"
    )
    .addIntegerOption((opt) =>
      opt
        .setName("id")
        .setDescription("ID de l'annonce à localiser")
        .setRequired(true)
    );
}

export const handleAdresse: CommandHandler = async (interaction, ctx) => {
  const id = interaction.options.getInteger("id", true);
  await interaction.deferReply();

  const { property, warnings } = await ensurePropertyEnriched(
    ctx.repository,
    id,
    "address"
  );
  if (!property) {
    await interaction.editReply(`Annonce #${String(id)} introuvable.`);
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
    console.error("[discord] Erreur recherche DPE:", error);
    await interaction.editReply(
      "Impossible de contacter l'API ADEME pour le moment. Réessayez plus tard."
    );
  }
};
