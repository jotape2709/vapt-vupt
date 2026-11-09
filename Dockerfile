# syntax=docker/dockerfile:1
# Imagem de DESENVOLVIMENTO e integração local (docker compose). Não é imagem de produção:
# roda TypeScript via tsx, inclui dependências de desenvolvimento e não fixa digest.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
# Redes com proxy que reemite TLS: passe a cadeia da empresa como segredo de build (não fica na imagem):
#   docker build --secret id=extra_ca,src=/caminho/ca.crt -t vapt-vupt-dev-app:local .
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund
COPY . .
RUN npm run build && chown -R node:node /app
ENV NODE_ENV=development WEB_DIST_DIR=/app/dist API_HOST=0.0.0.0 PORT=3001
USER node
EXPOSE 3001
# node direto (sem npx): sinais de parada chegam ao processo e o encerramento é limpo.
CMD ["node", "--import", "tsx", "apps/api/server.ts"]
