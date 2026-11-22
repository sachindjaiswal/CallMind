# syntax=docker/dockerfile:1
# Multi-target image for the CallMind monorepo.
# Targets: api, worker, web

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

# Install dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

# Copy source and build the shared workspace packages.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api
COPY apps/worker apps/worker
COPY apps/web apps/web
RUN npm run build -w @callmind/shared && npm run build -w @callmind/db

FROM base AS api
EXPOSE 8080
CMD ["npm", "run", "dev", "-w", "@callmind/api"]

FROM base AS worker
RUN apk add --no-cache ffmpeg
CMD ["npm", "run", "dev", "-w", "@callmind/worker"]

FROM base AS web
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@callmind/web", "--", "--host", "0.0.0.0", "--port", "5173"]
