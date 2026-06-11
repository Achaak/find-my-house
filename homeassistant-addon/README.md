# Déploiement sur Home Assistant (Raspberry Pi 4)

Ce guide installe **Find My House** comme add-on local sur Home Assistant OS.

## Prérequis

- Home Assistant OS sur Raspberry Pi 4 (64 bits recommandé)
- Accès au système de fichiers du Pi (Samba, Studio Code Server via HACS, ou SSH)
- Token et ID de votre bot Discord

## Installation

### 1. Copier le projet sur le Pi

Clonez ce dépôt dans le dossier des add-ons locaux :

```bash
cd /addons/local
git clone https://github.com/VOTRE-UTILISATEUR/find-my-house.git find-my-house
cd find-my-house
```

> Si `/addons/local` n'existe pas, installez l'add-on **Samba share** ou **SSH & Web Terminal** depuis le store Home Assistant.

### 2. Préparer l'add-on

```bash
./scripts/install-ha-addon.sh
```

Ce script copie `config.yaml` à la racine du dépôt (requis par le Supervisor HA).

### 3. Activer l'add-on dans Home Assistant

1. **Paramètres** → **Add-ons** → **Add-on store**
2. Menu **⋮** en haut à droite → **Vérifier les mises à jour** (pour détecter l'add-on local)
3. L'add-on **Find My House** apparaît sous **Local add-ons**
4. Cliquez **Installer** (le premier build prend 10–20 min sur Pi 4 : compilation de `better-sqlite3`)
5. Onglet **Configuration** : renseignez au minimum :
   - `discord_token`
   - `discord_client_id`
   - `discord_channel_id` (pour les notifications)
   - vos critères de recherche (`scrape_city`, `scrape_max_price`, etc.)
6. **Démarrer** l'add-on et activer **Démarrer au boot**

### 4. Production Discord

Laissez `discord_guild_id` **vide** en production pour enregistrer les commandes slash globalement (pas seulement sur un serveur de dev).

## Données persistantes

La base SQLite est stockée dans le volume add-on :

```
/data/listings.db
```

Ce volume survit aux redémarrages et mises à jour de l'add-on. Incluez-le dans vos sauvegardes Home Assistant.

Pour réutiliser votre base locale (`data/listings.db`), copiez-la sur le Pi avant le premier démarrage (via Samba ou `scp`) vers le dossier de données de l'add-on, puis renommez-la `listings.db`.

## Mise à jour

```bash
cd /addons/local/find-my-house
git pull
```

Puis dans HA : **Add-ons** → **Find My House** → **Reconstruire** → **Redémarrer**.

## Logs

**Paramètres** → **Add-ons** → **Find My House** → onglet **Log**

Vous devriez voir :

```
[app] Démarrage de Find My House...
[cron] Planifié: 0 */2 * * *
```

## Dépannage

| Problème                          | Solution                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Build échoue sur `better-sqlite3` | Vérifiez que le Pi est en **aarch64** (OS 64 bits). Le premier build est long, attendez 20 min. |
| Bot hors ligne sur Discord        | Vérifiez `discord_token` dans la config add-on                                                  |
| Pas de notifications              | Vérifiez `discord_channel_id` et les permissions du bot sur ce canal                            |
| Commandes slash absentes          | Retirez `discord_guild_id`, redémarrez l'add-on, attendez quelques minutes                      |

## Alternative : Docker Compose (hors HA)

Sur une machine Linux avec Docker (NAS, NUC) :

```bash
cp .env.example .env   # éditer les variables
docker compose up -d --build
```
