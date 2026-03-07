# Body Fat Tracker

Production-ready body fat tracker: log weight and calories, track progress toward a target body fat percentage.

## Tech Stack

- **Backend:** Express.js + TypeScript (strict), Prisma + SQLite (local) / PostgreSQL (production-ready), JWT
- **Frontend:** React + TypeScript (strict), vanilla CSS, mobile-first

## Quick Start (Local Development)

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend (from repo root)
cd frontend
npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env: set JWT_SECRET (and optionally PORT, CORS_ORIGIN).
# DATABASE_URL is already set for SQLite (file:./data/body_fat_tracker.db).
```

### 3. Create the database (SQLite)

From the `backend` directory:

```bash
# Create the data directory (SQLite file path)
mkdir -p data

# Apply schema (creates DB file and tables)
npx prisma db push
```

Or use migrations for versioned schema changes:

```bash
npx prisma migrate dev --name init
```

### 4. Generate Prisma client

Required after cloning or after changing `prisma/schema.prisma`:

```bash
cd backend
npx prisma generate
```

The `npm run dev` and `npm run build` scripts run `prisma generate` automatically.

### 5. Run the backend

```bash
cd backend
npm run dev
```

API runs at `http://localhost:3001`.

### 6. Run the frontend

```bash
cd frontend
npm run dev
```

App runs at `http://localhost:5173` and proxies `/api` to the backend.

---

## Environment (Backend)

| Variable        | Description                                      | Default / example                          |
|----------------|--------------------------------------------------|--------------------------------------------|
| `PORT`         | Server port                                      | `3001`                                     |
| `CORS_ORIGIN`  | Allowed origin for CORS                          | `http://localhost:5173`                     |
| `JWT_SECRET`   | Secret for signing JWTs                          | **Required** (set in production)           |
| `DATABASE_URL` | Prisma connection URL (required for Prisma CLI)   | `file:./data/body_fat_tracker.db` (SQLite)  |
| `DATABASE_FILE`| Optional; if set and `DATABASE_URL` unset, app uses `file:<DATABASE_FILE>` | `./data/body_fat_tracker.db` |
| `FRONTEND_URL` | Base URL for password-reset links | `http://localhost:5173` |
| `RESEND_API_KEY` | Resend.com API key for reset emails (optional; if unset, link is logged to console) | — |
| `RESEND_FROM`   | Sender for reset emails | `Body Fat Tracker <onboarding@resend.dev>` |

For **production** with PostgreSQL, change the `provider` in `backend/prisma/schema.prisma` to `postgresql` and set:

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## Prisma commands (Backend)

| Command | Description |
|--------|-------------|
| `npm run db:push` | Apply schema to DB (no migration history). Good for local SQLite. |
| `npm run db:seed` | Seed a test user with ~35 days of entries (dev/demo only). |
| `npm run db:migrate` | Create and run a migration (`prisma migrate dev`). Use for production/versioned schema. |
| `npm run db:studio` | Open Prisma Studio to inspect/edit data. |
| `npm run db:reset` | Reset DB (drops and reapplies). **Destructive.** |

### Test user (dev/demo)

After `db:push`, run `npm run db:seed` (or `npx prisma db seed`) to create a test user with about one month of realistic daily entries. Log in with:

- **Email:** test@example.com  
- **Password:** TestPassword123  

Use for demos, QA, or trying the app without manual data entry. Do not use in production.

### Reset the SQLite database

To wipe and recreate the local DB:

```bash
cd backend
npm run db:reset
# Or manually:
# rm -f data/body_fat_tracker.db
# npx prisma db push
```

---

## API

- `POST /api/users` – create user (returns `user` + `token`)
- `GET /api/users/:id` – get profile (Bearer token)
- `PATCH /api/users/:id` – update profile (optional fields: age, sex, height_cm, current_weight_kg, target_body_fat_percent, activity_level, lean_mass_kg)
- `POST /api/auth/login` – log in (email, password; returns `user` + `token`)
- `POST /api/auth/forgot-password` – request password reset (email; rate-limited; sends link if Resend configured)
- `POST /api/auth/reset-password` – set new password (token + password from email link)
- `POST /api/users/:id/entries` – log daily entry
- `GET /api/users/:id/entries` – list entries
- `GET /api/users/:id/progress` – progress metrics (computed goal, current from latest entry, trend, % toward goal)

**Weight semantics:** In progress, "current weight" = latest entry's weight when the user has entries, otherwise the profile (starting) weight. Profile "current weight" is the reference/starting value and is editable via PATCH.

---

## Project layout

```
backend/
  prisma/
    schema.prisma    # Canonical schema (SQLite; switch provider for Postgres/MySQL)
  src/
    config/db.ts    # Prisma client (singleton)
    middleware/     # auth, validation
    routes/         # users, entries, progress
    types/          # shared types
frontend/
  src/
    api/            # API client
    components/     # SignupForm, DailyLogForm
    types/          # API types
```

---

## Build & type check

```bash
# Backend (generates Prisma client and compiles TypeScript)
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

Strict TypeScript is enabled in both projects. The backend remains API-first and compatible with the existing React frontend; optional metrics stay collapsible and API contracts are unchanged.

## Production deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for production environment variables, build and run steps, SQLite backup notes, and optional Docker usage.
