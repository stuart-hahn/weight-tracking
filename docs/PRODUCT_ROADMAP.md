# Body Fat Tracker — Product Roadmap & Strategic Plan

**Document purpose:** Evolve the repository into a high-quality, user-focused product that a small team can operate efficiently. Monetization is deferred until the product demonstrates strong user value.

---

## 1. Product Understanding

### What the product currently does

- **Auth:** Sign up (email + password + profile), log in, JWT in localStorage; token verified on load via GET profile.
- **Data:** Users have profile (age, sex, height, current weight, target body fat %, optional activity level / lean mass). Daily entries: date, weight (required), optional calories, optional waist/hip.
- **UI:** Single-page app. When not logged in: tabbed “Log in” | “Create account”. When logged in: “Progress” card (current weight, goal weight, entry count, placeholder bar) + “Log today” form + Sign out.
- **API:** REST JSON; POST/GET users, POST/GET entries, GET progress; auth via Bearer token. PATCH profile and progress calculations are **stubs**.

### Who the likely target user is

- Adults tracking body composition (weight, eventually body fat) toward a target.
- Beginners who want simple, safe guidance (e.g. calorie range, rate of change) rather than raw data only.
- Mobile-first users (single-column, touch-friendly layout).

### Core value proposition (intended)

- **Track** weight (and optionally calories, waist/hip) with minimal friction.
- **See progress** toward a target body fat % via goal weight, trend, and progress bar.
- **Get actionable guidance:** safe calorie range, weekly summary, and clear “how am I doing?” feedback.

**Gap:** The app currently does not deliver this. Progress shows signup weight and a placeholder goal (goal = current weight); there is no trend, no calorie recommendation, no weekly summary, and “current” weight does not reflect logged entries.

---

## 2. Current Constraints (Highest Impact First)

### C1. Core value not delivered (progress & guidance)

- **Goal weight** is a stub (`goal_weight_kg = current_weight_kg` in `progress.ts`). No use of target body fat % or lean mass.
- **“Current” weight** in progress is `User.currentWeightKg` (set only at signup), not latest or trend from entries.
- **Progress bar** is `entries_count * 5` — not “% toward goal.”
- **No calorie recommendation**, no weekly summary, no trend (e.g. kg/week). Spec called these “mandatory” for a complete experience.

**Impact:** Users cannot answer “Am I on track?” or “What should I eat?” The product underdelivers on its promise.

### C2. No automated quality or safety net

- **No tests** (unit, integration, or e2e). Regressions and refactors are risky.
- **No CI** (lint, typecheck, test, build). Broken main is easy and hard to notice.
- **No structured error handling** in Express (e.g. global error middleware); some routes return 500 with generic messages.

**Impact:** Small team will slow down as the codebase grows; changes are fragile; production incidents harder to diagnose.

### C3. Profile and progress data model mismatch

- **User.currentWeightKg** is never updated when the user logs entries. Progress API reads this field, so “current weight” is stale.
- **PATCH /api/users/:id** is a stub; users cannot edit profile (e.g. update weight or target).
- Design is ambiguous: is “current weight” the last logged weight or a manually set profile field? Today it’s only the latter and only at signup.

**Impact:** Confusing UX (logged weight vs “current” in progress) and no way to correct profile.

### C4. Single-page only, no history or context

- No client-side routing; no dedicated “progress” or “history” view.
- Users cannot see a **list or chart of past entries** (only “Log today” and a single progress card).
- Entries are fetched in the API but **not displayed** in the UI (e.g. no table, no weight-over-time chart).

**Impact:** Low perceived value; users don’t see their trajectory or feel progress.

### C5. Operational and deployment readiness

- No Docker, no production runbook, no health/debug endpoints beyond `/health`.
- SQLite + Prisma 7 adapter is suitable for single-instance dev/small deploy but not documented for production (e.g. file path, backups).
- No logging/monitoring strategy; no rate limiting or security hardening (e.g. auth brute-force).

**Impact:** Harder to ship and operate reliably as a small team.

### C6. Onboarding and retention signals

- No email verification, password reset, or “forgot password.”
- No notion of “first goal” or onboarding steps; signup is one long form.
- No weekly summary or notification hook (even in-app) to bring users back.

**Impact:** Lower completion and retention; support burden for lost access.

---

## 3. Highest-Leverage Opportunities

| # | Opportunity | User value | Scalability / team | Rationale |
|---|-------------|------------|--------------------|-----------|
| 1 | **Real progress logic & “current” from entries** | High | Medium | Unblocks the core promise: goal weight, trend, % to goal. |
| 2 | **Expose entry history + weight trend (list/chart)** | High | Low | Makes progress visible and tangible. |
| 3 | **Calorie recommendation + weekly summary API & UI** | High | Medium | Actionable guidance and “how did this week go?” |
| 4 | **Test suite + CI** | Medium (indirect) | High | Safe refactors and confident deploys. |
| 5 | **Profile update (PATCH) + sync “current weight” from entries** | Medium | Low | Clear data model and editable profile. |
| 6 | **Structured errors + global handler** | Medium | High | Better DX and production debugging. |
| 7 | **Client-side routing + Progress/History views** | Medium | Medium | Clearer IA and room for charts/summaries. |
| 8 | **Deploy & run docs (e.g. Docker + env)** | Low (immediate) | High | Enables consistent staging/production. |

---

## 4. Implementation Plan (Prioritized)

### Immediate (next iteration)

#### 1. Real goal weight and progress from entries

- **Problem:** Goal weight is a stub; “current” weight is signup-only; progress bar is arbitrary.
- **Why it matters:** Delivers the core promise: “progress toward target body fat.”
- **Difficulty:** Medium.
- **Likely files/systems:** `backend/src/routes/progress.ts`, `backend/src/types/index.ts`, optional `backend/src/services/` (calculations), `frontend/src/components/DailyLogForm.tsx` (progress display), `frontend/src/types/api.ts`.
- **Implementation:**
  - **Goal weight:** Compute from target body fat % and either (a) `User.leanMassKg` if set, or (b) estimated lean mass (e.g. formula from age/sex/height/weight). Type-safe, deterministic function; return in progress API.
  - **Current weight:** In progress API, use **latest entry’s weight** (by date) when entries exist; otherwise fall back to `User.currentWeightKg`. Optionally keep user profile as “starting” weight and document semantics.
  - **Progress bar:** Derive “% toward goal” from current weight vs goal (e.g. for weight loss: (start - current) / (start - goal) capped at 0–100). Handle maintain/gain goals similarly.
  - **Trend:** Add `weight_trend_kg_per_week` (e.g. linear regression or simple delta over last N entries); return in progress response.
- **Success:** User sees a meaningful goal weight, current weight from their logs, and a progress bar that reflects distance to goal; API returns a numeric trend.

#### 2. Profile update (PATCH) and “current weight” semantics

- **Problem:** Users cannot edit profile; “current weight” is ambiguous and never updated from entries.
- **Why it matters:** Correctness and clarity; users can fix mistakes and set a proper “starting” weight.
- **Difficulty:** Low.
- **Likely files:** `backend/src/routes/users.ts` (PATCH handler), `backend/src/middleware/validate.ts` (validate update body), `frontend` (optional: simple profile/settings screen or reuse signup fields read-only + edit).
- **Implementation:**
  - Implement PATCH `/api/users/:id`: allow updating safe profile fields (e.g. age, sex, height_cm, current_weight_kg, target_body_fat_percent, activity_level, lean_mass_kg). Validate and apply via Prisma. Keep password change for a later iteration.
  - Decide and document: “current weight” in profile = reference/starting weight; progress “current” = latest entry (or profile if no entries). Optionally: when user logs an entry for “today,” update `User.currentWeightKg` so profile stays in sync (document this behavior).
- **Success:** PATCH works with validation; README/docs describe weight semantics.

---

### Near-term (next 2–3 iterations)

#### 3. Entry history and weight trend in the UI

- **Problem:** Users cannot see past entries or a weight-over-time view.
- **Why it matters:** Progress feels real when users see their trajectory.
- **Difficulty:** Medium.
- **Likely files:** `frontend/src/` (new or refactored views), `frontend/src/api/client.ts` (getEntries already exists), `frontend/src/App.tsx` (routing or state for “history”).
- **Implementation:**
  - Use existing GET entries API. Add a **History** or **Progress** section: list of entries (date, weight, optional calories) and a simple **line chart** (weight vs date, goal line if desired). Vanilla CSS; chart can be SVG or a small dependency (e.g. lightweight chart lib).
  - Default view can stay “Log today” with a link/button to “See history” or “Progress” that shows list + chart. No need for full router in v1 if a single page with toggled sections is enough.
- **Success:** User can see past entries and a weight trend chart; goal line visible when goal is implemented.

#### 4. Calorie recommendation and weekly summary

- **Problem:** No actionable calorie guidance or “how did this week go?” summary.
- **Why it matters:** Spec listed these as mandatory for a complete, beginner-friendly experience.
- **Difficulty:** Medium.
- **Likely files:** `backend/src/routes/progress.ts` or new `backend/src/routes/summary.ts`, `backend/src/services/` (TDEE, deficit, weekly aggregation), `frontend` (summary card, optional calorie display).
- **Implementation:**
  - **Calorie recommendation:** Add a service that computes TDEE (e.g. Mifflin–St Jeor) from age, sex, height, weight, activity level. Apply a safe deficit/surplus for ~0.5–1 kg/week; return `recommended_calories_min` / `recommended_calories_max` in progress or a dedicated endpoint. Type-safe, documented formulas.
  - **Weekly summary:** Endpoint (e.g. GET `/api/users/:id/summary?week=...`) or extend progress: weight change over last 7 days, comparison to goal rate, optional simple “on track” / “adjust” message. Return in API; render in a summary card on frontend.
- **Success:** User sees a recommended calorie range and a weekly summary with a simple interpretation.

#### 5. Test suite and CI

- **Problem:** No tests or CI; every change risks regressions.
- **Why it matters:** Enables confident iteration and safe refactors for a small team.
- **Difficulty:** Medium.
- **Likely files:** New `backend/**/*.test.ts`, `frontend/**/*.test.tsx` (or equivalent), `package.json` scripts, new CI config (e.g. GitHub Actions).
- **Implementation:**
  - **Backend:** Unit tests for progress/calculation logic (goal weight, trend, TDEE); integration tests for auth and key routes (login, create user, create entry, get progress) with a test DB or SQLite in-memory. Use a test runner (e.g. Vitest or Jest).
  - **Frontend:** Component tests for critical flows (login form, log entry, progress display); optionally e2e (Playwright) for “sign up → log entry → see progress” in one flow.
  - **CI:** On push/PR, run lint, typecheck, backend tests, frontend tests, build both. Require green for merge.
- **Success:** Key business logic and API contracts covered; CI runs on every PR.

#### 6. Structured error handling and global middleware

- **Problem:** Inconsistent error responses and no central place to log or format errors.
- **Why it matters:** Easier debugging and predictable API for frontend and future clients.
- **Difficulty:** Low.
- **Likely files:** `backend/src/index.ts`, new `backend/src/middleware/errorHandler.ts`, route handlers (replace ad-hoc res.status().json with throwing or next(err)).
- **Implementation:**
  - Add an Express error-handling middleware (four-arg `(err, req, res, next)`). Map known errors (e.g. validation, 401, 404, Prisma P2002) to status and `{ error: string }`. Unknown errors → 500 and generic message; log full error server-side.
  - Where appropriate, have routes throw or call `next(err)` instead of sending responses directly. Validation can throw after middleware runs.
- **Success:** All API errors go through one path; responses are consistent; 500s are logged.

---

### Strategic (future roadmap)

#### 7. Client-side routing and clearer information architecture

- **Problem:** Single page with no dedicated Progress/History/Settings; everything is one scroll.
- **Why it matters:** Room for charts, summaries, and settings without clutter.
- **Difficulty:** Medium.
- **Likely files:** `frontend/` (add router, e.g. React Router), split views: Log, Progress/History, Profile/Settings.
- **Implementation:** Introduce a minimal router; routes e.g. `/`, `/log`, `/progress`, `/settings`. Move “Log today” and “Progress” into appropriate routes; keep auth gate at app level.
- **Success:** Clear URLs and dedicated screens for logging, progress/history, and profile.

#### 8. Deployment and operations documentation

- **Problem:** No standard way to run in staging/production; SQLite usage and backups not documented.
- **Difficulty:** Low–Medium.
- **Likely files:** `README.md`, new `docs/DEPLOY.md`, optional `Dockerfile` and `docker-compose.yml`.
- **Implementation:** Document production env vars, build steps, and run steps. For SQLite: data directory, backup strategy, single-instance caveat. Optionally add Dockerfile(s) for backend and frontend (or static serve) and a simple compose for local “production-like” run. Add a simple “debug” or “ready” health check if useful.
- **Success:** A new developer or operator can deploy the app from the repo and docs.

#### 9. Password reset and account recovery (later)

- **Problem:** No “forgot password”; lost access means lost account.
- **Why it matters:** Reduces support burden and improves trust.
- **Difficulty:** Medium (email sending, tokens, security).
- **Implementation:** Deferred until after core value and retention are in place; requires email provider and secure token flow.
- **Success:** User can request a reset and set a new password via email link.

---

## 5. Success Criteria (Measurable Outcomes)

After implementing the plan (especially Immediate + Near-term), the product should show:

| Area | Indicator |
|------|------------|
| **Core value** | Goal weight is computed and shown; progress bar reflects “% toward goal”; current weight in UI comes from latest entry when available. |
| **Actionability** | User sees a recommended calorie range and a weekly summary with a simple “on track” / “adjust” style message. |
| **Transparency** | User can view entry history and a weight-over-time chart (and optionally goal line). |
| **Reliability** | Key calculations and API routes have tests; CI runs on every PR and blocks merge on failure. |
| **Operability** | Errors are structured and logged; deployment and env are documented (and optionally containerized). |
| **Data clarity** | Profile is editable (PATCH); “current weight” semantics are documented and consistent (e.g. progress = latest entry, profile = reference/starting). |

---

## 6. Execution Ordering Summary

| When | Items |
|------|--------|
| **Immediate** | (1) Real goal weight and progress from entries, (2) PATCH profile and current-weight semantics. |
| **Near-term** | (3) Entry history + trend chart in UI, (4) Calorie recommendation + weekly summary, (5) Test suite + CI, (6) Structured error handling. |
| **Strategic** | (7) Client routing + IA, (8) Deploy/ops docs (and optional Docker), (9) Password reset. |

---

## 7. Out of Scope for This Plan

- Monetization (premium features, subscriptions).
- Email verification, social login, or advanced auth.
- Native mobile apps; PWA/installability only if it fits later.
- Community, social, or multi-user features.
- Cosmetic or non–value-add refactors (e.g. renaming only, style-only changes).

---

*Last updated from repository exploration and codebase review. Revisit after each implementation cycle to reprioritize.*
