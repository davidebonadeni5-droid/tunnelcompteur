# Tunnel Compteur

Compteur **partagé** des « tunnels » de la semaine : chaque fois que quelqu'un part sur un sujet sans importance, on lui compte un tunnel. Chaque palier débloque un gage, et au dernier (15 tunnels par défaut) : **🥐 tournée de croissants**.

## Lancer

### Avec Docker (recommandé)

```bash
docker compose up -d --build
```

Ouvrir http://localhost:8090 : tous les écrans connectés voient les mêmes scores, mis à jour en direct.
Le port est lié à `127.0.0.1` : l'application n'est accessible que depuis la machine elle-même (passer par un reverse proxy pour l'ouvrir au réseau).
La base SQLite est stockée dans le volume `tunnel-data` et survit aux redémarrages et aux mises à jour.

### Sans Docker

Node.js 22.5 ou plus récent, **aucune dépendance à installer** :

```bash
npm start
```

Puis http://localhost:3000. La base est créée dans `data/tunnel.db`.

### Hors ligne, sans serveur

Ouvrir directement `public/index.html` : l'application passe en **mode local** (données dans le navigateur uniquement). Le badge en haut indique le mode actif.

## Configuration (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DB_PATH` | `data/tunnel.db` (`/data/tunnel.db` en Docker) | Fichier SQLite |
| `TZ` | fuseau du système (`Europe/Paris` dans le compose) | Définit « aujourd'hui » et le changement de semaine |
| `ADMIN_TOKEN` | vide | Si défini, toute modification exige ce jeton (à saisir dans ⚙ Réglages). La lecture reste libre. |

## Fonctionnalités

- **Cartes participant** : `+1`, `+5`, `−1`, saisie directe, titre humoristique (de « Concis » à « Boulanger officiel »), distance jusqu'aux croissants, gage en cours, alerte « journée tunnel », couronne du roi du tunnel.
- **Tableau de la semaine** : Lun→Dim éditables, tri, clic sur une ligne pour suivre la personne dans le tunnel, historique des semaines précédentes.
- **Tunnel provoqué** : un anneau par palier (15 par défaut), champ d'étoiles en mouvement, onde de choc et particules à chaque tunnel ajouté, confettis à chaque palier, écran plein de croissants au dernier palier, sur **tous** les écrans connectés.
- **Réglages des paliers et des gages** :
  - nombre de paliers (3 à 20), un tunnel par palier ou un pas fixe, ou seuils libres (+ courbe progressive en un clic) ;
  - icône, libellé, description et couleur de chaque palier ;
  - 3 thèmes prêts à l'emploi : gages & croissants, boulangerie, sobre ;
  - alerte du jour (N tunnels dans la journée) ;
  - gage d'équipe, palier d'équipe calculé sur la moyenne, le minimum ou le maximum ;
  - **gages personnels** par participant (✎ sur la carte, ex. pains au chocolat au lieu de croissants) ;
  - intensité des effets par écran (maximum / normale / réduite).
- **Données** : export / import JSON, données d'exemple, réinitialisation de la semaine. Les compteurs sont conservés semaine par semaine dans la base.

## API

| Méthode | Route | Corps |
|---|---|---|
| GET | `/api/state` | — |
| GET | `/api/events` | flux SSE des changements |
| POST | `/api/users` | `{name, color, overrides}` |
| PATCH / DELETE | `/api/users/:id` | `{name, color, overrides}` |
| POST | `/api/users/:id/score` | `{day, delta}` ou `{day, value}` |
| PUT | `/api/settings` | réglages complets |
| POST | `/api/reset`, `/api/demo`, `/api/import` | — / — / export JSON |
| GET | `/api/export` | — |

Le brief détaillé est dans [`PROMPT.md`](PROMPT.md).
