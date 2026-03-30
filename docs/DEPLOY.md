# Deployment Guide

This document describes how to build and run the Body Fat Tracker API and frontend in a production-like environment.

**Branching:** To deploy only when you merge to `main`, use feature branches and configure Render/Vercel to deploy from `main` only. See [BRANCHING_AND_DEPLOY.md](BRANCHING_AND_DEPLOY.md).

## Environment variables (production)

### Backend

| Variable        | Description                                      | Required |
|----------------|--------------------------------------------------|----------|
| `PORT`         | Server port (e.g. `3001`)                         | No (default: 3001) |
| `CORS_ORIGIN`  | Allowed origin for CORS (e.g. `https://your-app.com`) | Yes (set to your frontend origin) |
| `JWT_SECRET`   | Secret for signing JWTs                          | **Yes** (use a long, random secret) |
| `DATABASE_URL` | Database connection URL                          | **Yes** |
| `FRONTEND_URL` | Base URL of the frontend (for password-reset links) | No (default: `http://localhost:5173`) |
| `RESEND_API_KEY` | Resend.com API key for sending password-reset emails | No (if unset, reset link is logged to stdout) |
| `RESEND_FROM`  | Sender email for password reset (e.g. `App <noreply@yourdomain.com>`) | No |

**Rate limiting:** All `/api` routes are limited to 100 requests per 15 minutes per IP. Stricter limits apply to auth: login (10 per 15 minutes), forgot-password (5 per 15 minutes). Responses include `Retry-After` when a limit is exceeded.

- **SQLite (single instance):**  
  `DATABASE_URL=file:/var/lib/body-fat-tracker/data.db`  
  Use an absolute path. Ensure the process has read/write access to the directory and file. SQLite is suitable for a single server; no separate DB process. Back up the `.db` file regularly (e.g. cron copy or snapshot). For multi-instance or high concurrency, use PostgreSQL.
- **PostgreSQL:**  
  See [PostgreSQL runbook](#postgresql-runbook) below. Set  
  `DATABASE_URL=postgresql://user:password@host:5432/dbname`.

### Frontend

The frontend is static (HTML/JS/CSS). Configure your reverse proxy or static server so that:

- The app is served at the root (or a subpath) and supports client-side routing (all routes serve `index.html`).
- API requests are proxied to the backend (e.g. `/api` → `http://backend:3001`), or set the frontend to call the backend URL explicitly (would require a build-time or runtime config).

## Build steps

### Backend

```bash
cd backend
npm ci
npx prisma generate
npm run build
```

Output: `backend/dist/` (compiled JavaScript). The Prisma client is generated into `backend/generated/prisma` and used at runtime.

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Output: `frontend/dist/` (static assets: `index.html`, JS, CSS). Serve this directory with any static file server or reverse proxy.

## Run

### Backend (Node)

```bash
cd backend
node dist/index.js
```

Or with a process manager (e.g. systemd, PM2): run `node dist/index.js` with `NODE_ENV=production` and the env vars above. Ensure the working directory is `backend` (or that `DATABASE_URL` and any file paths are absolute).

### Frontend (Vercel) – point to backend

The frontend uses `VITE_API_URL` at build time for the API base URL. If unset, it falls back to `/api` (same-origin).

1. In **Vercel** → your project → **Settings** → **Environment Variables**, add:
   - **Name:** `VITE_API_URL`
   - **Value:** your backend URL including the `/api` path, no trailing slash, e.g. `https://weight-tracking-iwor.onrender.com/api`
   - Apply to **Production** (and Preview if you want).
2. **Redeploy** the frontend so the new build picks up the variable (trigger a new deployment after saving).

### Frontend (static)

Serve the `frontend/dist` directory:

- **nginx:** root pointing to `frontend/dist`, and a `try_files` (or equivalent) so all routes return `index.html` for client-side routing.
- **Same server as API:** e.g. Express can serve static files from `frontend/dist` and proxy `/api` to the backend if both run together.

### Deploying the backend to Render

1. Create a **Web Service**, connect your repo, set **Root Directory** to `backend`.
2. **Build command:** `npm ci && npx prisma generate && npm run build`
3. **Start command:** `node dist/index.js`
4. Set **Environment** variables (see table above):
   - `DATABASE_URL` = your Neon PostgreSQL connection string.
   - `CORS_ORIGIN` = your Vercel frontend URL, e.g. `https://weight-tracking-beta.vercel.app` (no trailing slash).
   - `JWT_SECRET` = a long random secret (e.g. `openssl rand -hex 32`).
   - `FRONTEND_URL` = same as CORS_ORIGIN (for password-reset and verification links).
5. **Apply the schema to Neon** once (from your machine): `cd backend`, set `DATABASE_URL` to your Neon URL, then run `npx prisma db push` (or `npx prisma migrate deploy` if you use migrations).
6. **Important:** Ensure devDependencies are installed during the build (TypeScript and `@types/*` are in devDependencies). If Render sets `NODE_ENV=production` before the build, the install may skip them and the build will fail. In Render’s **Environment** tab, either leave `NODE_ENV` unset for the build, or add a build-time variable `NODE_ENV=development` so that `npm ci` installs devDependencies. You can set `NODE_ENV=production` only at runtime (e.g. in the start command or in a runtime-only env group) if your platform supports it.

### SQLite: path and backup

- Use an **absolute path** for `DATABASE_URL` (e.g. `file:/var/lib/body-fat-tracker/data.db`) so the app and Prisma CLI use the same file regardless of current working directory.
- **Backup:** copy the `.db` file while the app is idle, or use SQLite’s backup API. Avoid copying mid-write; schedule backups during low traffic.
- **Single instance:** SQLite does not support multiple writers across processes. Run one backend process per database file. For horizontal scaling, use PostgreSQL (or another multi-writer DB).

## Optional: Docker

### Backend only (SQLite in volume)

Example `Dockerfile` in project root or `backend/`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json backend/
RUN npm ci --omit=dev
COPY backend/ .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

Build and run (SQLite file in a volume):

```bash
docker build -t body-fat-tracker-api -f backend/Dockerfile .  # if Dockerfile is in backend/
# or: docker build -t body-fat-tracker-api .  # if Dockerfile copies backend/
docker run -p 3001:3001 \
  -e JWT_SECRET=your-secret \
  -e CORS_ORIGIN=https://your-frontend.com \
  -e DATABASE_URL=file:/data/body_fat_tracker.db \
  -v bft-data:/data \
  body-fat-tracker-api
```

### Frontend (nginx)

Build the frontend, then serve with nginx in a second container or combine into a multi-stage build that copies `frontend/dist` into an nginx image. Point nginx to the backend for `/api` if needed.

### docker-compose (backend + SQLite volume)

Example `docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN:-http://localhost:5173}
      - DATABASE_URL=file:/data/body_fat_tracker.db
    volumes:
      - bft-data:/data
volumes:
  bft-data:
```

Run: `docker compose up -d`. Set `JWT_SECRET` and `CORS_ORIGIN` in `.env` or the shell.

## PostgreSQL runbook

Use this runbook when moving from SQLite to PostgreSQL (e.g. for production, high availability, or multi-instance scaling).

### 1. Prerequisites

- A PostgreSQL 14+ server (local or managed).
- Connection string: `postgresql://USER:PASSWORD@HOST:5432/DATABASE`.

### 2. Switch provider in schema

In `backend/prisma/schema.prisma`, change the datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Remove any SQLite-specific types if present (the current schema uses standard types that work on both).

### 3. Create the database

On the PostgreSQL server, create the database if it does not exist:

```sql
CREATE DATABASE body_fat_tracker;
```

### 4. Run migrations

From the backend directory, with `DATABASE_URL` set to your PostgreSQL URL:

```bash
cd backend
export DATABASE_URL="postgresql://user:password@host:5432/body_fat_tracker"
npx prisma migrate dev --name init_postgres
```

This creates a migration from the current schema. For an existing production SQLite DB you would need a data migration (export from SQLite, import to Postgres) separately; this runbook covers a fresh Postgres setup or a new environment.

### 5. Deploy

- Set `DATABASE_URL` in your production environment to the PostgreSQL URL.
- Run `npx prisma generate` and `npm run build` in your build step (no need to run migrations in the app process if you ran them in step 4; for CI/production you can run `npx prisma migrate deploy` before starting the app).
- Start the backend as usual. The app uses Prisma and does not contain SQLite-specific code, so it works with PostgreSQL without code changes.

### 6. Caveats and notes

- **Date/time:** Prisma maps `DateTime` to `timestamp with time zone` on PostgreSQL. The app stores dates in UTC; ensure your connection timezone or app logic is consistent.
- **Backup:** Use PostgreSQL backup tools (e.g. `pg_dump`, managed backups) instead of file copies.
- **Migrations:** For production, run `prisma migrate deploy` in your deploy pipeline after setting `DATABASE_URL`; do not use `migrate dev` in production.
- **CI / integration tests:** This repo’s GitHub Actions job uses a `postgres:16` service with `POSTGRES_DB=body_fat_tracker_test` and runs `npm run test:integration` in `backend/`. For local runs, create that database once (see **README → Quick Start §6**); the default URL matches `postgresql://postgres:postgres@localhost:5432/body_fat_tracker_test`.

## Checklist

- [ ] Set `JWT_SECRET` to a strong random value.
- [ ] Set `CORS_ORIGIN` to the frontend origin.
- [ ] Use absolute `DATABASE_URL` for SQLite; ensure directory exists and is writable.
- [ ] For SQLite: single backend process; schedule backups.
- [ ] For production DB: run `prisma migrate deploy` (or equivalent) before starting the app.
- [ ] Serve frontend with client-side routing (fallback to `index.html`).
- [ ] Prefer HTTPS in production.
