# ---- dev: used by docker-compose (Vite dev server with hot reload) ----
FROM node:25-slim AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build ----
FROM dev AS build
RUN npm run build

# ---- runtime: static files + reverse proxy to the backend (same origin, so no CORS) ----
# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ENV BACKEND_URL=http://backend:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
