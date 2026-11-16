# Prompt amélioré — « Tunnel Compteur »

> Version réécrite du brief d'origine : ambiguïtés levées, règles de calcul explicites, critères d'acceptation testables.

---

**Rôle** : Développeur front-end senior, spécialiste des animations CSS/SVG et designer UI/UX (interfaces spatiales, gamification).

**Objectif** : Livrer **un seul fichier `index.html`** (HTML + CSS + JS vanilla, aucune dépendance, aucun build) qui s'ouvre directement dans le navigateur : un compteur de performance hebdomadaire par utilisateur avec système de récompenses, dans l'esthétique « salle de contrôle NASA » (fond nuit, typographie technique monospace, lueurs néon, glassmorphism, télémétrie en direct).

## 1. Règles métier (à respecter exactement)

| Notion | Règle |
|---|---|
| Score du jour | Valeur du jour courant (lundi = index 0 … dimanche = 6, d'après la date locale). |
| Total semaine | Somme lundi → dimanche. |
| Palier tunnel (0–10) | `min(10, floor(totalSemaine / pointsParTunnel))`, `pointsParTunnel` réglable (défaut 5). |
| Grade spatial | 11 grades liés au palier (0 = « Recrue » … 10 = « Commandant de Portail »). |
| Récompense | Celle du palier atteint ; les 10 récompenses (icône + libellé) sont modifiables. |
| Tunnel central | Mode « Équipe » = palier moyen arrondi à l'inférieur ; ou palier de l'utilisateur sélectionné. |
| Nouvelle semaine | Les compteurs repassent à 0 automatiquement (utilisateurs et récompenses conservés). |
| Valeurs | Entiers ≥ 0, jamais négatifs. |

## 2. Interface

1. **En-tête** : titre « Tunnel aujourd'hui de la semaine », badge pulsant « Télémétrie active • Objectif : 10 Tunnels », horloge UTC, total équipe.
2. **Tunnel provoqué** (section centrale) : 10 anneaux SVG concentriques en perspective, numérotés 1→10.
   - Anneau inactif : gris, pointillés lents. Actif : cyan→violet, rotation `rotateZ` + `stroke-dashoffset` animés, `drop-shadow`. Anneau 10 : or `#FFB800`.
   - À chaque `+1`/`+5` : onde de choc qui traverse les anneaux actifs de 1 jusqu'au palier (délai en cascade), accélération temporaire de la rotation, rafale de particules **à la couleur de l'utilisateur**.
   - Passage au palier 10 : animation plein écran d'hyperespace (traînées d'étoiles) + ouverture du portail doré, fermable au clic.
3. **Cartes utilisateur** (grille responsive) : nom, couleur, grade, compteur du jour, boutons `−1` `+1` `+5`, saisie directe, barre de progression vers le prochain tunnel, récompense débloquée (badge lumineux). Actions : modifier, supprimer (avec confirmation), ajouter.
4. **Vue télémétrie** (tableau) : Utilisateur, Lun…Dim (cellules éditables, jour courant surligné), Aujourd'hui, Semaine, Palier /10, Récompense. Tri par semaine / aujourd'hui / palier / nom. Clic sur une ligne = sélection : surbrillance de la ligne et de la carte, le tunnel central affiche sa progression.
5. **Réglages** : édition des 10 récompenses, points par tunnel, bouton « Données d'exemple », bouton « Réinitialiser » (avec confirmation).

## 3. Contraintes techniques

- Palette : fond `#0B0D17`, panneaux `rgba(16,22,42,.75)` + `backdrop-filter: blur`, cyan `#00F0FF`, violet `#7B2CBF`, or `#FFB800`. Couleurs en variables CSS.
- Animations uniquement sur `transform`, `opacity`, `filter` (+ `stroke-dashoffset` sur SVG) ; `will-change` ciblé ; respect de `prefers-reduced-motion`.
- Persistance `localStorage` (clé versionnée) avec repli silencieux si indisponible.
- Responsive 360 px → 1920 px, sans défilement horizontal de la page (le tableau défile dans son conteneur).
- Accessibilité : boutons avec `aria-label`, focus visibles, contrastes AA.
- Données d'exemple pré-remplies (4 utilisateurs à des paliers variés, dont un proche du palier 10) pour tout voir dès l'ouverture.

## 4. Critères d'acceptation

- [ ] Ouvrir `index.html` hors ligne affiche cartes, tableau et tunnel remplis, sans erreur console.
- [ ] `+1` sur une carte déclenche l'onde de choc et met à jour carte, tableau et tunnel.
- [ ] Atteindre le palier 10 déclenche l'hyperespace doré une seule fois par franchissement.
- [ ] Rechargement de la page = état conservé ; « Réinitialiser » remet tout à zéro.
- [ ] Ajout / modification / suppression d'utilisateur fonctionnels.
