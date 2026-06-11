import { SlashCommandBuilder } from "discord.js";
import type { CommandHandler } from "./types.js";

export function buildAideCommand() {
  return new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Afficher l'aide du bot");
}

export const handleAide: CommandHandler = async (interaction) => {
  await interaction.reply(
    [
      "**Find My House** — Commandes disponibles:",
      "",
      "`/annonces` — Rechercher en base (ville, CP, texte, source, prix, surface, terrain, pièces, chambres, ancien/neuf, rayon, temps de trajet, tri…)",
      "`/annonce id:123` — Détail d'une annonce (boutons ❤️ / 👎)",
      "`/adresse id:123` — Identifier l'adresse d'une annonce via l'ADEME (validation par bouton)",
      "`/jaime ajouter|retirer|liste` — Gérer vos favoris",
      "`/pas-jaime ajouter|retirer|liste` — Gérer vos non-favoris",
      "_Cliquez sur ❤️ ou 👎 sous une annonce pour l'ajouter ou la retirer._",
      "`/scraper` — Lancer un scraping (critères définis dans le .env)",
      "`/stats` — Statistiques de la base",
      "`/version` — Version de l'application",
      "`/aide` — Afficher cette aide",
    ].join("\n")
  );
};
