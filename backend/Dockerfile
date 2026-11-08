# ---- dev: used by docker-compose (bind-mounted source, hot reload) ----
FROM node:20-slim AS dev
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- build ----
FROM dev AS build
RUN npm run build && npm prune --omit=dev

# ---- runtime: small, non-root, production deps only ----
FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000 9100
# Migrations are a separate step (Kubernetes Job / Helm hook / CI deploy job): `npx prisma migrate deploy`.
CMD ["node", "dist/main.js"]
