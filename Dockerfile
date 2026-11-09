# Imagem de DESENVOLVIMENTO e integração local (docker compose). Não é imagem de produção:
# roda TypeScript via tsx, inclui dependências de desenvolvimento e não fixa digest.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && chown -R node:node /app
ENV NODE_ENV=development WEB_DIST_DIR=/app/dist API_HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
CMD ["npx", "tsx", "apps/api/server.ts"]
