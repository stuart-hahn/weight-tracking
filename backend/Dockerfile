# Build and run Body Fat Tracker API (Node + Prisma; SQLite at runtime).
# Build from repo root: docker build -f backend/Dockerfile .
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY backend/prisma.config.ts ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
