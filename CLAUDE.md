# Consignes pour Claude Code

## Port Docker
- Le mapping de port dans `docker-compose.yml` est **`"127.0.0.1:8090:3000"`** : ne pas le modifier.
- Ne jamais remettre `8080` (ni dans `docker-compose.yml`, ni dans le README, ni ailleurs).
- L'application s'ouvre sur http://localhost:8090 (écoute uniquement en local, pas exposée sur le réseau).
- Le port interne du serveur Node reste `3000` (`PORT` dans le Dockerfile).
