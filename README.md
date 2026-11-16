# Tunnel Compteur

Compteur de performance hebdomadaire **partagé** avec système de récompenses (10 tunnels), thème salle de contrôle spatiale.

## Lancer

### Avec Docker (recommandé)

```bash
docker compose up -d --build
```

Ouvrir http://localhost:8080 : tous les écrans connectés voient les mêmes scores, mis à jour en direct.
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

- **Cartes utilisateur** : `+1`, `+5`, `−1`, saisie directe, grade, barre de progression, récompense débloquée, objectif du jour, couronne du leader.
- **Vue télémétrie** : Lun→Dim éditables, tri, clic sur une ligne pour suivre l'utilisateur dans le tunnel, historique des semaines précédentes.
- **Tunnel provoqué** : 10 anneaux SVG en perspective qui suivent la souris, champ d'étoiles en distorsion (canvas), onde de choc et rafale de particules à chaque ajout, allumage des anneaux en cascade, confettis à chaque récompense, hyperespace doré plein écran au Tunnel 10, sur **tous** les écrans connectés.
- **Réglages des récompenses** :
  - paliers à pas fixe ou seuils personnalisés par tunnel (+ courbe progressive en un clic) ;
  - icône, libellé, description et couleur de chacune des 10 récompenses ;
  - 3 thèmes prêts à l'emploi : spatial, récompenses concrètes, rangs de jeu ;
  - objectif quotidien avec sa récompense ;
  - récompense d'équipe, palier d'équipe calculé sur la moyenne, le minimum ou le maximum ;
  - **récompenses personnelles** par utilisateur (✎ sur la carte) ;
  - intensité des effets par écran (maximum / normale / réduite).
- **Données** : export / import JSON, données d'exemple, réinitialisation de la semaine. Les scores sont conservés semaine par semaine dans la base.

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
