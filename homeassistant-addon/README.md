# Déploiement sur Home Assistant (Raspberry Pi 4)

Ce guide installe **Find My House** comme app locale sur Home Assistant OS (anciennement « add-on »).

## Prérequis

- Home Assistant OS sur Raspberry Pi 4 (64 bits recommandé)
- Accès au système de fichiers du Pi (Samba, Studio Code Server via HACS, ou SSH)
- Token et ID de votre bot Discord

## Installation

### 1. Préparer le bundle sur votre Mac

Sur votre machine de dev (pas sur le Pi) :

```bash
./scripts/bundle-ha-addon.sh
```

Cela crée le dossier `ha-addon-bundle/` avec **tout ce qu'il faut** pour le build Docker (~50 fichiers, pas seulement `config.yaml` + `Dockerfile`).

> L'erreur `"/src": not found` ou `dockerfile is missing` signifie que seuls 2–3 fichiers ont été copiés sur le Pi. Il faut tout le bundle.

### 2. Copier sur le Pi via Samba

1. Installez l'app **Samba share** dans HA
2. Mac : **Finder → Se connecter au serveur** → `smb://homeassistant.local/addons`
3. Ouvrez `local/find-my-house/` (créez-le si besoin)
4. **Supprimez** l'ancien contenu (souvent seulement 3 fichiers)
5. Copiez **tout le contenu** de `ha-addon-bundle/` (pas le dossier lui-même, mais son contenu)

Vérifiez dans Samba que vous voyez bien : `package.json`, `src/`, `prisma/`, `Dockerfile`, `config.yaml`, `run.sh`.

**Alternative git** (si accès terminal au host) :

```bash
cd /addons/local
git clone https://github.com/VOTRE-UTILISATEUR/find-my-house.git find-my-house
cd find-my-house
./scripts/install-ha-addon.sh
./scripts/verify-ha-addon.sh
```

### 3. Installer dans Home Assistant

1. **Paramètres** → **Apps** (anciennement Add-ons)
2. Menu **⋮** en haut à droite → **Vérifier les mises à jour**
3. L'app **Find My House** apparaît sous **Apps locales**
4. Cliquez **Installer** (le premier build prend 10–20 min sur Pi 4 : compilation de `better-sqlite3`)
5. Onglet **Configuration** : renseignez au minimum :
   - `discord_token`
   - `discord_client_id`
   - `discord_channel_id` (pour les notifications)
   - vos critères de recherche (`scrape_city`, `scrape_max_price`, etc.)
6. **Démarrer** l'app et activer **Démarrer au démarrage**

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

Puis dans HA : **Apps** → **Find My House** → **Reconstruire** → **Redémarrer**.

## Logs

**Paramètres** → **Apps** → **Find My House** → onglet **Log**

Vous devriez voir :

```
[app] Démarrage de Find My House...
[cron] Planifié: 0 */2 * * *
```

## Dépannage

| Problème                          | Solution                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `dockerfile is missing`           | Le `Dockerfile` n'est pas à la racine du dossier app. Relancez `./scripts/bundle-ha-addon.sh` et recopiez tout le contenu via Samba.           |
| `"/src": not found` au build      | Seuls 2–3 fichiers copiés (contexte Docker ~1,6 Ko). Recopiez **tout** le contenu de `ha-addon-bundle/`, pas seulement `homeassistant-addon/`. |
| Build échoue sur `better-sqlite3` | Vérifiez que le Pi est en **aarch64** (OS 64 bits). Le premier build est long, attendez 20 min.                                                |
| Bot hors ligne sur Discord        | Vérifiez `discord_token` dans la config add-on                                                                                                 |
| Pas de notifications              | Vérifiez `discord_channel_id` et les permissions du bot sur ce canal                                                                           |
| Commandes slash absentes          | Retirez `discord_guild_id`, redémarrez l'add-on, attendez quelques minutes                                                                     |

## Alternative : Docker Compose (hors HA)

Sur une machine Linux avec Docker (NAS, NUC) :

```bash
cp .env.example .env   # éditer les variables
docker compose up -d --build
```
