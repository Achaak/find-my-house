import {
  MessageFlagsBitField,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

function memberRoleIds(interaction: ChatInputCommandInteraction): string[] {
  const member = interaction.member;
  if (!member) return [];

  if ("roles" in member && Array.isArray(member.roles)) {
    return member.roles;
  }

  return (member as GuildMember).roles.cache.map((role) => role.id);
}

export function canRunPrivilegedCommand(
  interaction: ChatInputCommandInteraction,
  adminRoleId: string | undefined
): boolean {
  if (!interaction.inGuild()) return false;

  if (interaction.guild?.ownerId === interaction.user.id) {
    return true;
  }

  if (!adminRoleId) {
    return false;
  }

  return memberRoleIds(interaction).includes(adminRoleId);
}

export async function denyPrivilegedCommand(
  interaction: ChatInputCommandInteraction,
  adminRoleId: string | undefined
): Promise<void> {
  const content = adminRoleId
    ? "Vous n'avez pas la permission d'exécuter cette commande."
    : "Cette commande est désactivée : configurez `DISCORD_ADMIN_ROLE_ID`.";

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content });
    return;
  }

  await interaction.reply({
    content,
    flags: MessageFlagsBitField.Flags.Ephemeral,
  });
}
