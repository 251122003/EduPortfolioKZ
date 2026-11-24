# EduPortfolio KZ: one image serves the API under /api and the built React app (single origin).
# Build and run locally, and deploy to Render: see docs/deployment.md.

# Prisma downloads its migration engine for the detected OpenSSL version, so every stage has it.
FROM node:24-alpine AS base
RUN apk add --no-cache openssl

# 1. Frontend: Vite build into /app/dist.
FROM base AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
# The frontend reuses the API payload types from the backend.
COPY backend/src/auth/auth.types.ts ./backend/src/auth/auth.types.ts
RUN npm run build

# 2. Backend: generate the Prisma Client and compile NestJS into /app/backend/dist.
FROM base AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
# prisma.config.ts requires DATABASE_URL; generate does not connect, so a placeholder is enough.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build

# 3. Production dependencies only (includes the Prisma CLI for `migrate deploy`).
FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 4. Runtime image.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=backend-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /app/backend/dist ./dist
COPY --chown=node:node backend/package.json backend/prisma.config.ts ./
COPY --chown=node:node backend/prisma ./prisma
COPY --from=frontend-build --chown=node:node /app/dist /app/dist
USER node
EXPOSE 3000
# Applies pending migrations, then starts the server on 0.0.0.0:$PORT.
CMD ["npm", "run", "start:migrate"]
