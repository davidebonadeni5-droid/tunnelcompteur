# Tunnel Compteur

Compteur de performance hebdomadaire et système de récompenses (10 tunnels), thème salle de contrôle spatiale.

**Lancer :** ouvrir `index.html` dans un navigateur (aucune dépendance, fonctionne hors ligne).

- Cartes par utilisateur : `+1`, `+5`, `−1`, saisie directe, grade, récompense débloquée
- Vue télémétrie : Lun→Dim éditables, tri, clic sur une ligne pour suivre l'utilisateur dans le tunnel
- Tunnel provoqué : 10 anneaux SVG animés, onde de choc + particules à chaque ajout, hyperespace doré au Tunnel 10
- Palier = `min(10, floor(total semaine / points par tunnel))` (5 par défaut, réglable)
- Sauvegarde `localStorage`, remise à zéro automatique chaque nouvelle semaine, bouton Réinitialiser

Le brief amélioré est dans [`PROMPT.md`](PROMPT.md).

## Docker

Image nginx (alpine) qui sert `index.html`.

```bash
docker compose up -d --build
```

Puis ouvrir http://localhost:8080. Sans Compose :

```bash
docker build -t tunnel-compteur . && docker run -d -p 8080:80 --name tunnel-compteur tunnel-compteur
```

Les données restent dans le `localStorage` du navigateur : le conteneur ne stocke rien.
