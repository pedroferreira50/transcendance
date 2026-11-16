# syntax=docker/dockerfile:1

# Production image: build the frontend, then serve it with nginx as the only entry point.
# nginx serves the static files and proxies /api and /socket.io to the backend.

FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/self-signed-cert.sh /docker-entrypoint.d/40-self-signed-cert.sh
RUN chmod +x /docker-entrypoint.d/40-self-signed-cert.sh
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 80 443