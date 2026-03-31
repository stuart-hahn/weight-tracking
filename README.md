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

### 6. Backend integration tests (optional)

API integration tests use a **separate** database (`body_fat_tracker_test`) so they do not touch your dev data. The dev container only creates `body_fat_tracker` by default, so create the test database once:

```bash
docker compose exec -T db psql -U postgres -c "CREATE DATABASE body_fat_tracker_test;"
```

If you use PostgreSQL without Docker (same `postgres` / `postgres` credentials on `localhost`):

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE body_fat_tracker_test;"
```

Then from `backend`:

```bash
npm run test:integration
```

This runs `prisma db push` against the test URL, then Vitest. Override the URL if needed: `DATABASE_URL=postgresql://... npm run test:integration`. On Windows without Git Bash, set `DATABASE_URL` in the environment before running the same commands.

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
| `npm run db:push:test` | Apply schema to `body_fat_tracker_test` (used by `test:integration`). |
| `npm run test:integration` | `db:push:test` + API integration tests (requires test DB to exist; see Quick Start §6). |
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
- `PATCH /api/users/:id` – update profile (optional fields: age, sex, height_cm, current_weight_kg, target_body_fat_percent, activity_level, lean_mass_kg, units, `training_block_started_at` ISO date/datetime or null, `last_calibration_week_index`)
- `POST /api/auth/login` – log in (email, password; returns `user` + `token`)
- `POST /api/auth/forgot-password` – request password reset (email; rate-limited; sends link if Resend configured)
- `POST /api/auth/reset-password` – set new password (token + password from email link)
- `POST /api/auth/verify-email` – verify email (token from signup email link)
- `POST /api/users/:id/entries` – log daily entry
- `GET /api/users/:id/entries` – list entries
- `GET /api/users/:id/progress` – progress metrics (computed goal, current from latest entry, trend, % toward goal)
- `POST /api/users/:id/optional-metrics` – upsert body fat % for a date
- `GET /api/users/:id/optional-metrics` – list optional metrics (body fat by date)
- `GET /api/users/:id/export` – export user data (profile + entries + optional metrics + workouts + `workout_programs`) as JSON (Bearer token)

**Workouts (all Bearer, `:id` must match token user):**

- `GET /api/users/:id/exercises` – list exercises (`q`, `favorites_only`, `custom_only`); global catalog + user custom; `custom_only=true` returns only the user’s custom exercises
- `POST /api/users/:id/exercises` – create custom exercise (`name`, `kind`: `weight_reps` \| `bodyweight_reps` \| `time`); **409** if a custom exercise with the same name already exists
- `GET /api/users/:id/exercises/:exerciseId` – exercise detail
- `POST /api/users/:id/exercises/:exerciseId/duplicate` – copy a visible exercise (global or own) into a new custom row (`name` optional); kind is copied; **409** if no free name
- `POST /api/users/:id/exercises/batch-insights` – body `{ exercise_ids: string[], progression_variant_by_exercise_id?: Record<exerciseId, variant> }` → `{ insights: Record<exerciseId, payload> }` (single round-trip for session load)
- `GET /api/users/:id/exercises/:exerciseId/insights` – last performance + suggestion + `progression_variant` (strategy-based hint)
- `POST /api/users/:id/exercises/:exerciseId/favorite` – add favorite
- `DELETE /api/users/:id/exercises/:exerciseId/favorite` – remove favorite
- `PATCH /api/users/:id/exercises/:exerciseId` – update custom exercise (**409** on duplicate name)
- `DELETE /api/users/:id/exercises/:exerciseId` – delete custom exercise
- `GET /api/users/:id/workouts` – list workouts (`status=in_progress` \| `completed`, `limit`)
- `POST /api/users/:id/workouts` – start workout (optional `clone_from_workout_id` **or** `program_day_id`, `name`, `notes`)
- `GET /api/users/:id/workouts/:workoutId` – workout detail with exercises and sets
- `PATCH /api/users/:id/workouts/:workoutId` – update (e.g. `notes`, `completed_at`)
- `DELETE /api/users/:id/workouts/:workoutId` – delete workout
- `POST /api/users/:id/workouts/:workoutId/exercises` – add line (`exercise_id`, optional `sets[]`)
- `PATCH /api/users/:id/workouts/:workoutId/exercises/:lineId` – line notes, `default_rest_seconds`, `order_index`
- `DELETE /api/users/:id/workouts/:workoutId/exercises/:lineId` – remove line
- `POST /api/users/:id/workouts/:workoutId/exercises/:lineId/sets` – add set
- `PATCH /api/users/:id/workouts/:workoutId/exercises/:lineId/sets/:setId` – update set
- `DELETE /api/users/:id/workouts/:workoutId/exercises/:lineId/sets/:setId` – delete set (weights in kg in JSON)

**Programs (Bearer, `:id` = user):**

- `GET /api/users/:id/programs` – list programs (summary)
- `POST /api/users/:id/programs` – create (`name`, optional `description`)
- `GET /api/users/:id/programs/:programId` – program with days, exercises, set templates
- `PATCH /api/users/:id/programs/:programId` – update name/description
- `DELETE /api/users/:id/programs/:programId` – delete program
- `POST /api/users/:id/programs/:programId/days` – add day (`name`, optional `order_index`)
- `PATCH /api/users/:id/programs/:programId/days/:dayId` – update day
- `DELETE /api/users/:id/programs/:programId/days/:dayId` – delete day
- `POST .../days/:dayId/exercises` – add exercise line (`exercise_id`, optional `progression_variant`, `order_index`)
- `PATCH .../days/:dayId/exercises/:pdeId` – reorder (`order_index`) or change `progression_variant`
- `DELETE .../days/:dayId/exercises/:pdeId` – remove line
- `POST .../exercises/:pdeId/templates` – add set template (`set_role`: `top` \| `backoff` \| `working`, optional targets, `percent_of_top` for backoff)
- `DELETE .../exercises/:pdeId/templates/:templateId` – remove template

**Training week (deload / calibration cues):** If `training_block_started_at` is set on the user, the API computes `training_week_index` as full weeks since that instant, starting at week 1. Deload is treated as weeks where `weekIndex % 6 === 0`; calibration windows use `weekIndex % 4 === 0` (see `backend/src/services/trainingWeek.ts`). Starting a workout from a program day snapshots `training_week_index` and `is_deload_week` on the `Workout` row.

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

Strict TypeScript is enabled in both projects. The backend is API-first; the React app includes workouts, programs, and batched insights against the routes above.

**CI:** The GitHub Actions workflow starts Postgres with `POSTGRES_DB=body_fat_tracker_test`, so no extra `CREATE DATABASE` step is needed there.

## Production deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for production environment variables, build and run steps, SQLite backup notes, and optional Docker usage.
