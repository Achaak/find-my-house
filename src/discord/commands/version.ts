import { SlashCommandBuilder } from "discord.js";
import { getBuildInfo } from "../../version.js";
import type { CommandHandler } from "./types.js";

export function buildVersionCommand() {
  return new SlashCommandBuilder()
    .setName("version")
    .setDescription("Show application version");
}

export const handleVersion: CommandHandler = async (interaction) => {
  const { version, commit } = getBuildInfo();
  const lines = [`**Find My House** v${version}`];
  if (commit) {
    lines.push(`Commit: \`${commit.slice(0, 7)}\``);
  }
  await interaction.reply(lines.join("\n"));
};
