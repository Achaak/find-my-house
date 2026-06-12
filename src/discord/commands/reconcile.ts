import { SlashCommandBuilder } from "discord.js";
import { scrapeConfig } from "../../config/scrape.js";
import { getPrisma } from "../../db/prisma.js";
import { reconcileProperties } from "../../scripts/reconcile-properties.js";
import { canRunPrivilegedCommand, denyPrivilegedCommand } from "../auth.js";
import type { CommandHandler } from "./types.js";

export function buildReconcileCommand() {
  return new SlashCommandBuilder()
    .setName("reconcile")
    .setDescription(
      "Fusionner les doublons en base (admin) : clé stricte, matching fuzzy et agences Bienici"
    );
}

function formatReconcileSummary(result: {
  merged: number;
  fuzzyMerged: number;
  unique: number;
  agencyFieldsUpdated: number;
}): string {
  return [
    "**Réconciliation terminée**",
    `• ${String(result.merged)} doublon(s) strict(s) fusionné(s)`,
    `• ${String(result.fuzzyMerged)} doublon(s) fuzzy fusionné(s)`,
    `• ${String(result.unique)} bien(s) unique(s) en base`,
    `• ${String(result.agencyFieldsUpdated)} publication(s) agence mises à jour`,
  ].join("\n");
}

export const handleReconcile: CommandHandler = async (interaction, ctx) => {
  if (!canRunPrivilegedCommand(interaction, ctx.discord.adminRoleId)) {
    await denyPrivilegedCommand(interaction, ctx.discord.adminRoleId);
    return;
  }

  await interaction.deferReply();

  const result = await reconcileProperties(
    getPrisma(scrapeConfig.database.url)
  );

  await interaction.editReply(formatReconcileSummary(result));
};
