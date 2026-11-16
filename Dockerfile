# Tunnel Compteur — serveur Node + base SQLite partagée (aucune dépendance npm)
FROM node:22-alpine

ENV NODE_ENV=production PORT=3000 DB_PATH=/data/tunnel.db
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
RUN mkdir -p /data && chown node:node /data

USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
