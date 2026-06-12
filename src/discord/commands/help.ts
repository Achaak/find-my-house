import { SlashCommandBuilder } from "discord.js";
import type { CommandHandler } from "./types.js";

export function buildHelpCommand() {
  return new SlashCommandBuilder()
    .setName("help")
    .setDescription("Afficher l'aide du bot");
}

export const handleHelp: CommandHandler = async (interaction) => {
  await interaction.reply(
    [
      "**Find My House** — Commandes disponibles:",
      "",
      "`/listings` — Rechercher en base (ville, CP, texte, source, prix, surface, terrain, pièces, chambres, ancien/neuf, rayon, temps de trajet, tri…)",
      "`/browse` — Parcourir les annonces une par une (❤️ / 👎 / Arrêter), classées par compatibilité",
      "`/listing id:123` — Détail d'une annonce (boutons ❤️ / 👎)",
      "`/address id:123` — Identifier l'adresse d'une annonce via l'ADEME (validation par bouton)",
      "`/like add|remove|list` — Gérer vos favoris",
      "`/dislike add|remove|list` — Gérer vos non-favoris",
      "_Cliquez sur ❤️ ou 👎 sous une annonce pour l'ajouter ou la retirer._",
      "`/scraper` — Lancer un scraping (critères définis dans le .env, admin)",
      "`/reconcile` — Fusionner les doublons en base (admin)",
      "`/stats overview|sources|prices|mine|activity` — Statistiques de la base",
      "`/version` — Version de l'application",
      "`/help` — Afficher cette aide",
    ].join("\n")
  );
};
