# Body Fat Tracker

Production-ready body fat tracker: log weight and calories, track progress toward a target body fat percentage.

## Tech Stack

- **Backend:** Express.js + TypeScript (strict), Prisma + PostgreSQL, JWT
- **Frontend:** React + TypeScript (strict), vanilla CSS, mobile-first

## Quick Start (Local Development)

Local dev uses **PostgreSQL**. Easiest: run Postgres in Docker, then run the app on your machine.

### 1. Start a local database

From the repo root:

```bash
docker compose up -d db
```

This starts PostgreSQL 16 on `localhost:5432` with user `postgres`, password `postgres`, database `body_fat_tracker`.

**Alternative:** Use a [Neon](https://neon.tech) branch or any `postgresql://` URL and skip Docker.

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`. For Docker Postgres above, use:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/body_fat_tracker
JWT_SECRET=any-random-string-for-local-dev
```

Leave `CORS_ORIGIN` unset or set to `http://localhost:5173`.

### 4. Apply the schema and (optional) seed

```bash
cd backend
npx prisma generate
npx prisma db push
npm run db:seed   # optional: test user test@example.com / TestPassword123
```

### 5. Run backend and frontend

**Terminal 1 – backend:**

```bash
cd backend
npm run dev
```

API: `http://localhost:3001`.

**Terminal 2 – frontend:**

```bash
cd frontend
npm run dev
```

App: `http://localhost:5173`. The Vite dev server proxies `/api` to the backend; no `VITE_API_URL` needed locally.

---

## Environment (Backend)

| Variable        | Description                                      | Local default / example                    |
|----------------|--------------------------------------------------|--------------------------------------------|
| `PORT`         | Server port                                      | `3001`                                     |
| `CORS_ORIGIN`  | Allowed origin for CORS                          | `http://localhost:5173`                     |
| `JWT_SECRET`   | Secret for signing JWTs                          | Any string locally; **required** in prod   |
| `DATABASE_URL` | PostgreSQL connection URL                        | `postgresql://postgres:postgres@localhost:5432/body_fat_tracker` |
| `FRONTEND_URL` | Base URL for password-reset/verification links   | `http://localhost:5173`                    |
| `RESEND_API_KEY` | Resend.com API key (optional)                  | If unset, reset link is logged to console  |
| `RESEND_FROM`  | Sender for reset emails                          | —                                          |

---

## Prisma commands (Backend)

| Command | Description |
|--------|-------------|
| `npm run db:push` | Apply schema to the DB (no migration history). |
| `npm run db:seed` | Seed a test user with ~35 days of entries (dev/demo only). |
| `npm run db:migrate` | Create and run a migration (`prisma migrate dev`). |
| `npm run db:studio` | Open Prisma Studio to inspect/edit data. |
| `npm run db:reset` | Reset DB (drops and reapplies). **Destructive.** |

### Test user (dev/demo)

After `db:seed`, log in with:

- **Email:** test@example.com  
- **Password:** TestPassword123  

Do not use in production.

---

## API

- `POST /api/users` – create user (returns `user` + `token`)
- `GET /api/users/:id` – get profile (Bearer token)
- `PATCH /api/users/:id` – update profile (optional fields: age, sex, height_cm, current_weight_kg, target_body_fat_percent, activity_level, lean_mass_kg)
- `POST /api/auth/login` – log in (email, password; returns `user` + `token`)
- `POST /api/auth/forgot-password` – request password reset (email; rate-limited; sends link if Resend configured)
- `POST /api/auth/reset-password` – set new password (token + password from email link)
- `POST /api/auth/verify-email` – verify email (token from signup email link)
- `POST /api/users/:id/entries` – log daily entry
- `GET /api/users/:id/entries` – list entries
- `GET /api/users/:id/progress` – progress metrics (computed goal, current from latest entry, trend, % toward goal)
- `POST /api/users/:id/optional-metrics` – upsert body fat % for a date
- `GET /api/users/:id/optional-metrics` – list optional metrics (body fat by date)
- `GET /api/users/:id/export` – export user data (profile + entries + optional metrics + workouts) as JSON (Bearer token)

**Workouts (all Bearer, `:id` must match token user):**

- `GET /api/users/:id/exercises` – list exercises (`q`, `favorites_only`); global catalog + user custom
- `POST /api/users/:id/exercises` – create custom exercise (`name`, `kind`: `weight_reps` \| `bodyweight_reps` \| `time`)
- `GET /api/users/:id/exercises/:exerciseId` – exercise detail
- `GET /api/users/:id/exercises/:exerciseId/insights` – last performance + suggestion
- `POST /api/users/:id/exercises/:exerciseId/favorite` – add favorite
- `DELETE /api/users/:id/exercises/:exerciseId/favorite` – remove favorite
- `PATCH /api/users/:id/exercises/:exerciseId` – update custom exercise
- `DELETE /api/users/:id/exercises/:exerciseId` – delete custom exercise
- `GET /api/users/:id/workouts` – list workouts (`status=in_progress` \| `completed`, `limit`)
- `POST /api/users/:id/workouts` – start workout (optional `clone_from_workout_id`, `name`, `notes`)
- `GET /api/users/:id/workouts/:workoutId` – workout detail with exercises and sets
- `PATCH /api/users/:id/workouts/:workoutId` – update (e.g. `notes`, `completed_at`)
- `DELETE /api/users/:id/workouts/:workoutId` – delete workout
- `POST /api/users/:id/workouts/:workoutId/exercises` – add line (`exercise_id`, optional `sets[]`)
- `PATCH /api/users/:id/workouts/:workoutId/exercises/:lineId` – line notes, `default_rest_seconds`, `order_index`
- `DELETE /api/users/:id/workouts/:workoutId/exercises/:lineId` – remove line
- `POST /api/users/:id/workouts/:workoutId/exercises/:lineId/sets` – add set
- `PATCH /api/users/:id/workouts/:workoutId/exercises/:lineId/sets/:setId` – update set
- `DELETE /api/users/:id/workouts/:workoutId/exercises/:lineId/sets/:setId` – delete set (weights in kg in JSON)

**Weight semantics:** In progress, "current weight" = latest entry's weight when the user has entries, otherwise the profile (starting) weight. Profile "current weight" is the reference/starting value and is editable via PATCH.

---

## Branches and production deploys

Use **feature branches** for work; merge into `main` only when you want to deploy to production. CI runs on every push and on PRs. Configure Render and Vercel so that **only `main`** triggers production; other branches can use preview deploys if you want. See **[docs/BRANCHING_AND_DEPLOY.md](docs/BRANCHING_AND_DEPLOY.md)** for the full workflow.

## Project layout

```
backend/
  prisma/
    schema.prisma    # Canonical schema (PostgreSQL)
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
