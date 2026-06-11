import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  MessageFlagsBitField,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import { fetchDpeByNumero } from "../utils/energy/ademeDpeApi.js";
import type { RankedDpeSearchResult } from "../utils/energy/dpePropertyMatch.js";

const CONFIRM_PREFIX = "dpe:addr:";
const REJECT_PREFIX = "dpe:none:";

function googleMapsUrl(candidate: RankedDpeSearchResult): string {
  if (candidate.latitude !== null && candidate.longitude !== null) {
    const query = `${String(candidate.latitude)},${String(candidate.longitude)}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(candidate.address)}`;
}

export function buildDpeCandidateComponents(
  propertyId: number,
  candidates: RankedDpeSearchResult[]
) {
  const mapsRow = new ActionRowBuilder<ButtonBuilder>();
  const confirmRow = new ActionRowBuilder<ButtonBuilder>();

  for (const [index, candidate] of candidates.entries()) {
    const number = String(index + 1);
    mapsRow.addComponents(
      new ButtonBuilder()
        .setLabel(`🗺️ ${number}`)
        .setStyle(ButtonStyle.Link)
        .setURL(googleMapsUrl(candidate))
    );
    confirmRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${CONFIRM_PREFIX}${String(propertyId)}:${candidate.numeroDpe}`
        )
        .setLabel(`✅ ${number}`)
        .setStyle(ButtonStyle.Success)
    );
  }

  const rejectRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REJECT_PREFIX}${String(propertyId)}`)
      .setLabel("Aucune de ces adresses")
      .setStyle(ButtonStyle.Secondary)
  );

  return [mapsRow, confirmRow, rejectRow];
}

function parseDpeButtonCustomId(
  customId: string
):
  | { propertyId: number; numeroDpe: string }
  | { propertyId: number; reject: true }
  | null {
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

export async function handleDpeButton(
  interaction: ButtonInteraction,
  repository: ListingRepository
): Promise<boolean> {
  const parsed = parseDpeButtonCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({
    flags: MessageFlagsBitField.Flags.Ephemeral,
  });

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
      `DPE **${parsed.numeroDpe}** introuvable. Relancez \`/adresse id:${String(parsed.propertyId)}\`.`
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
