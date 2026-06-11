import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import { fetchDpeByNumero } from "../utils/ademeDpeApi.js";
import type { RankedDpeSearchResult } from "../utils/dpePropertyMatch.js";

const CONFIRM_PREFIX = "dpe:addr:";
const REJECT_PREFIX = "dpe:none:";

function truncateButtonLabel(index: number, address: string): string {
  const prefix = `${String(index)}. `;
  const maxLen = 80 - prefix.length;
  const short =
    address.length > maxLen ? `${address.slice(0, maxLen - 1)}…` : address;
  return `${prefix}${short}`;
}

export function buildDpeCandidateComponents(
  propertyId: number,
  candidates: RankedDpeSearchResult[]
) {
  const candidateRow = new ActionRowBuilder<ButtonBuilder>();
  for (const [index, candidate] of candidates.entries()) {
    candidateRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONFIRM_PREFIX}${String(propertyId)}:${candidate.numeroDpe}`)
        .setLabel(truncateButtonLabel(index + 1, candidate.address))
        .setStyle(ButtonStyle.Primary)
    );
  }

  const rejectRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REJECT_PREFIX}${String(propertyId)}`)
      .setLabel("Aucune de ces adresses")
      .setStyle(ButtonStyle.Secondary)
  );

  return [candidateRow, rejectRow];
}

function parseDpeButtonCustomId(
  customId: string
): { propertyId: number; numeroDpe: string } | { propertyId: number; reject: true } | null {
  if (customId.startsWith(CONFIRM_PREFIX)) {
    const payload = customId.slice(CONFIRM_PREFIX.length);
    const separator = payload.indexOf(":");
    if (separator === -1) return null;

    const propertyId = Number(payload.slice(0, separator));
    const numeroDpe = payload.slice(separator + 1);
    if (!Number.isInteger(propertyId) || propertyId <= 0 || !numeroDpe) {
      return null;
    }

    return { propertyId, numeroDpe };
  }

  if (customId.startsWith(REJECT_PREFIX)) {
    const propertyId = Number(customId.slice(REJECT_PREFIX.length));
    return Number.isInteger(propertyId) && propertyId > 0
      ? { propertyId, reject: true }
      : null;
  }

  return null;
}

export function isDpeButtonCustomId(customId: string): boolean {
  return (
    customId.startsWith(CONFIRM_PREFIX) || customId.startsWith(REJECT_PREFIX)
  );
}

export async function handleDpeButton(
  interaction: ButtonInteraction,
  repository: ListingRepository
): Promise<boolean> {
  const parsed = parseDpeButtonCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const property = await repository.findById(parsed.propertyId);
  if (!property) {
    await interaction.editReply(
      `Annonce #${String(parsed.propertyId)} introuvable.`
    );
    return true;
  }

  if ("reject" in parsed) {
    await interaction.message.edit({ components: [] }).catch(() => undefined);
    await interaction.editReply(
      `Aucune adresse enregistrée pour l'annonce **#${String(parsed.propertyId)}**.`
    );
    return true;
  }

  const dpe = await fetchDpeByNumero(parsed.numeroDpe);
  if (!dpe) {
    await interaction.editReply(
      `DPE **${parsed.numeroDpe}** introuvable. Relancez \`/dpe id:${String(parsed.propertyId)}\`.`
    );
    return true;
  }

  await repository.updateAddress(parsed.propertyId, dpe.address, dpe.numeroDpe);
  await interaction.message.edit({ components: [] }).catch(() => undefined);
  await interaction.editReply(
    [
      `✅ Adresse enregistrée pour l'annonce **#${String(parsed.propertyId)}** :`,
      `**${dpe.address}**`,
      `_DPE ${dpe.numeroDpe}_`,
    ].join("\n")
  );
  return true;
}
