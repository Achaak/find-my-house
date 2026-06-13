import { SlashCommandBuilder } from "discord.js";
import { scrapeConfig } from "../../config/scrape.js";
import { getPrisma } from "../../db/prisma.js";
import { reconcileProperties } from "../../services/reconcileService.js";
import { canRunPrivilegedCommand, denyPrivilegedCommand } from "../auth.js";
import type { CommandHandler } from "./types.js";

export function buildReconcileCommand() {
  return new SlashCommandBuilder()
    .setName("reconcile")
    .setDescription(
      "Merge duplicate properties in the database (admin): strict key, fuzzy matching, and Bienici agencies"
    );
}

function formatReconcileSummary(result: {
  merged: number;
  fuzzyMerged: number;
  unique: number;
  agencyFieldsUpdated: number;
}): string {
  return [
    "**Reconciliation complete**",
    `• ${String(result.merged)} strict duplicate(s) merged`,
    `• ${String(result.fuzzyMerged)} fuzzy duplicate(s) merged`,
    `• ${String(result.unique)} unique propert${result.unique === 1 ? "y" : "ies"} in database`,
    `• ${String(result.agencyFieldsUpdated)} agency publication(s) updated`,
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
