# Prompt amélioré — « Tunnel Compteur »

> Brief réécrit : concept clarifié, règles de calcul explicites, critères d'acceptation testables.

**Rôle** : développeur front-end et back-end, spécialiste des animations CSS/SVG/canvas et designer UI/UX orienté gamification.

**Concept** : un « tunnel », c'est quand quelqu'un part sur un sujet sans importance (digression, monologue hors sujet). L'équipe compte les tunnels de chacun pendant la semaine. Chaque palier atteint donne un gage humoristique ; au dernier palier (15 tunnels par défaut), la personne paie **une tournée de croissants** 🥐.

## 1. Règles

| Notion | Règle |
|---|---|
| Tunnels du jour | Compteur du jour courant (lundi = 0 … dimanche = 6, fuseau du serveur). |
| Total semaine | Somme lundi → dimanche ; remise à zéro automatique chaque lundi, semaines passées conservées. |
| Paliers | N paliers (défaut 15, réglable 3–20). Seuils : 1 tunnel par palier, pas fixe, ou seuils libres strictement croissants. |
| Dernier palier | Gage final, par défaut « Tournée de croissants ». Déclenche l'animation plein écran. |
| Alerte du jour | Optionnelle : N tunnels dans la même journée (défaut 3). |
| Palier d'équipe | Moyenne, minimum ou maximum des paliers ; gage d'équipe au dernier palier. |
| Gages personnels | Chaque participant peut remplacer l'icône / le libellé de n'importe quel palier. |
| Valeurs | Entiers ≥ 0. |

## 2. Interface

1. En-tête « Tunnel aujourd'hui de la semaine », badge « 🥐 à 15 tunnels », état de connexion, total de l'équipe.
2. **Tunnel provoqué** : un anneau SVG par palier en perspective. À chaque ajout : onde de choc, accélération, particules à la couleur de la personne. Au dernier palier : écran plein écran doré avec pluie de croissants.
3. **Cartes participant** : nom, titre humoristique, compteur du jour, `−1` `+1`, saisie directe, bouton « Tournée payée » (dettes reportées d'une semaine à l'autre), distance jusqu'aux croissants, gage actuel ; ajout / modification / suppression.
4. **Tableau de la semaine** : Lun→Dim éditables, total, palier, gage ; tri ; clic = suivre la personne dans le tunnel.
5. **Réglages** : paliers, gages (thèmes prêts à l'emploi), alerte du jour, gage d'équipe, intensité des effets, export / import.

## 3. Technique

- Serveur Node.js + SQLite intégré, sans dépendance ; API REST + Server-Sent Events pour la synchro en direct entre écrans.
- Repli en mode local (localStorage) si la page est ouverte sans serveur.
- Docker : image Node alpine, volume persistant pour la base, `TZ` configurable, jeton administrateur optionnel.
- Palette : fond `#0B0D17`, panneaux verre `rgba(16,22,42,.75)`, cyan `#00F0FF`, violet `#7B2CBF`, or croissant `#FFB800`.
- Animations sur `transform` / `opacity`, `prefers-reduced-motion` respecté ; responsive 360 → 1920 px.

## 4. Critères d'acceptation

- [ ] Deux navigateurs ouverts : un `+1` sur l'un apparaît sur l'autre en moins d'une seconde, avec l'animation.
- [ ] Atteindre le dernier palier affiche l'écran croissants une fois par franchissement, sur tous les écrans.
- [ ] Changer le nombre de paliers met à jour le nombre d'anneaux et les seuils.
- [ ] Redémarrer le conteneur conserve les données.
- [ ] Ouvrir `public/index.html` sans serveur fonctionne en mode local.
