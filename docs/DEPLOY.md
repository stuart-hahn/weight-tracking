# Deployment Guide

This document describes how to build and run the Body Fat Tracker API and frontend in a production-like environment.

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

- **SQLite (single instance):**  
  `DATABASE_URL=file:/var/lib/body-fat-tracker/data.db`  
  Use an absolute path. Ensure the process has read/write access to the directory and file. SQLite is suitable for a single server; no separate DB process. Back up the `.db` file regularly (e.g. cron copy or snapshot). For multi-instance or high concurrency, use PostgreSQL.
- **PostgreSQL:**  
  Change `provider` in `backend/prisma/schema.prisma` to `postgresql`, run migrations, and set  
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

Output: `backend/dist/` (compiled JavaScript). The Prisma client is generated into `backend/src/generated/prisma` and used at runtime.

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

### Frontend (static)

Serve the `frontend/dist` directory:

- **nginx:** root pointing to `frontend/dist`, and a `try_files` (or equivalent) so all routes return `index.html` for client-side routing.
- **Same server as API:** e.g. Express can serve static files from `frontend/dist` and proxy `/api` to the backend if both run together.

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

## Checklist

- [ ] Set `JWT_SECRET` to a strong random value.
- [ ] Set `CORS_ORIGIN` to the frontend origin.
- [ ] Use absolute `DATABASE_URL` for SQLite; ensure directory exists and is writable.
- [ ] For SQLite: single backend process; schedule backups.
- [ ] For production DB: run `prisma migrate deploy` (or equivalent) before starting the app.
- [ ] Serve frontend with client-side routing (fallback to `index.html`).
- [ ] Prefer HTTPS in production.
