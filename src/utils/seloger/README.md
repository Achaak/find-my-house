# SeLoger scraper

SeLoger n'expose pas d'API publique stable : le scraper lit le HTML des pages
recherche et détail, puis extrait les blobs JSON embarqués (`initialData`,
`__UFRN_FETCHER__`).

## Stratégie anti-bot

- **Headers navigateur** : User-Agent Chrome récent, `Sec-CH-UA`, `Sec-Fetch-*`,
  `Accept-Language: fr-FR`.
- **Délais entre requêtes** (séquentiels, globaux au process) :
  - recherche : `SEARCH_PAGE_DELAY_MS` (800 ms) dans `client.ts`
  - détail : `DETAIL_FETCH_DELAY_MS` (400 ms) dans `client.ts`
- **Referer** : page d'accueil pour la recherche, `/classified-search` pour le
  détail (`Sec-Fetch-Site: same-origin`).
- **Pas de parallélisme** sur les pages SeLoger : chaque fetch attend le délai
  minimum depuis le précédent.
- **HTTP 403** → `SeLogerAccessBlockedError` : retirer `seloger` de
  `SCRAPE_SCRAPERS` ou réduire la fréquence des scrapes.

## Parsers (`parsers/`)

| Module              | Rôle                                             |
| ------------------- | ------------------------------------------------ |
| `embeddedJson.ts`   | `window["…"]=JSON.parse("…")` via `vm`           |
| `searchHtml.ts`     | Résultats recherche (`initialData` ou UFRN SERP) |
| `searchMetadata.ts` | DPE/GES depuis texte des cartes                  |
| `detailEnergy.ts`   | DPE/GES + kWh/m² sur page détail                 |
| `detailPage.ts`     | Agrège énergie, description, surface, coords     |
| `coordinates.ts`    | lat/lng depuis JSON embarqué ou URL Mapbox       |
| `classifiedCard.ts` | `SeLogerClassifiedData` → carte                  |
| `energyText.ts`     | Regex classes énergie dans le texte              |

## Coordonnées

Les cartes de recherche n'ont en général pas de lat/lng. Les coords sont
extraites à l'enrichissement (page détail) depuis :

1. `classifiedData.location.coordinates` / `.geo`
2. `classifiedData.rawData.latitude` / `.longitude`
3. URL Mapbox statique ou GeoJSON échappé dans le HTML

Les annonces SeLoger-only sans enrichissement restent hors filtre geo
`/annonces` tant que `latitude`/`longitude` sont `null` en base.

## Tests

Fixtures HTML minimales dans `fixtures/`. Les parsers sont testés sans réseau ;
les fetchers (`client.ts`) ne le sont pas.
