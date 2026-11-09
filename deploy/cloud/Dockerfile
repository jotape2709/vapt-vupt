# syntax=docker/dockerfile:1
# Imagem de PRODUÇÃO da aplicação Vapt-Vupt (API + interface estática). Construa a partir da raiz:
#   docker build -f deploy/cloud/Dockerfile -t vapt-vupt-app:<versão> .
# Difere da imagem de desenvolvimento (Dockerfile da raiz): JavaScript compilado, sem tsx nem
# dependências de desenvolvimento, NODE_ENV=production e usuário sem privilégios.
# Atrás de proxy que reemite TLS: --secret id=extra_ca,src=/caminho/ca.crt (não fica na imagem).
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm run build:server

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM ${NODE_IMAGE}
ARG VV_VERSION=unknown
LABEL org.opencontainers.image.title="vapt-vupt-app" org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VV_VERSION}"
WORKDIR /app
ENV NODE_ENV=production WEB_DIST_DIR=/app/dist API_HOST=0.0.0.0 PORT=3001 VV_VERSION=${VV_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /src/dist ./dist
COPY --from=build /src/dist-server ./dist-server
COPY db ./db
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=90s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist-server/api/server.js"]
