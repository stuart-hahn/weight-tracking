# Body Fat Tracker — Product Roadmap & Strategic Plan

**Document purpose:** Evolve the repository into a high-quality, user-focused product that a small team can operate efficiently. Monetization is deferred until the product demonstrates strong user value.

---

## 1. Product Understanding

### What the product currently does

- **Auth:** Sign up (email + password + profile), log in, JWT in localStorage; token verified on load via GET profile. **Password reset:** forgot-password (rate-limited) and reset-password with email link (Resend or console log when no API key).
- **Data:** User profile (age, sex, height, current weight, target body fat %, optional activity level / lean mass, **units**, **onboardingComplete**, **plan**). Daily entries: date, weight (required), optional calories, optional waist/hip. **OptionalMetric** table exists in Prisma (body_fat_percent per user/date) but has **no API or UI** yet.
- **UI:** React SPA with client-side routing. Routes: `/` (landing: login/signup), `/log`, `/progress`, `/settings`, `/forgot-password`, `/reset-password`, `/onboarding`. Progress card: current weight (from latest entry), goal weight (computed), progress bar (%-toward-goal), calorie range, weekly summary. Entry history with weight-vs-date chart and goal line. **Metric/imperial** preference in Settings and signup; formatted weights (e.g. 1 decimal kg, whole lb). Retention banner when user has not logged today. New users see a short onboarding flow (confirm goal, log first entry).
- **API:** REST JSON; POST/GET users, PATCH profile, POST/GET entries, GET progress (computed goal, trend, calories, weekly summary, units). Auth via Bearer token. Global error handler and request logger (requestId + JSON log).
- **Quality & ops:** Vitest (backend unit tests for progress/calories; frontend component tests). CI (GitHub Actions): typecheck, test, build for backend and frontend. [docs/DEPLOY.md](DEPLOY.md) and optional Docker. Seed: test user with ~35 days of entries (test@example.com / TestPassword123).

### Who the likely target user is

- Adults tracking body composition (weight, eventually body fat) toward a target.
- Beginners who want simple, safe guidance (calorie range, weekly “on track” feedback) rather than raw data only.
- Mobile-first users (single-column, touch-friendly layout).

### Core value proposition

- **Track** weight (and optionally calories, waist/hip) with minimal friction.
- **See progress** toward a target body fat % via goal weight, trend, and progress bar.
- **Get actionable guidance:** safe calorie range, weekly summary, and clear “how am I doing?” feedback.

**Status:** Core value is delivered. Goal weight is computed (Boer/lean mass); current weight comes from latest entry when entries exist; progress bar shows % toward goal; trend, calorie recommendation, and weekly summary are implemented and shown in the UI.

---

## 2. Current Constraints (Remaining Gaps)

### C1. OptionalMetrics (body fat) unused

- Schema has `OptionalMetric` (user_id, date, body_fat_percent) but no API or UI. Users cannot log or view body fat.
- **Impact:** Optional spec not completed; limits differentiation and body-fat-specific value.

### C2. No email verification

- Any email can be used to sign up; no verification link or flag. Hurts deliverability for password reset and future emails; fake or mistyped emails create accounts.
- **Impact:** Trust and support burden; spam or typo accounts.

### C3. Login not rate-limited

- Forgot-password is rate-limited; login is not. Brute-force on login is possible.
- **Impact:** Security and operational risk.

### C4. No data export

- Users cannot download their data (profile + entries). Trust and portability (e.g. GDPR-style) not addressed.
- **Impact:** Trust and compliance gap.

### C5. No API integration tests

- Unit tests (progress, calories) and frontend component tests exist; no tests that hit the real API with a real DB. Contract and auth flow regressions possible.
- **Impact:** Refactors and route changes are riskier.

### C6. Single-instance SQLite

- Documented for production (path, backup) but limits HA and multi-instance scale when traffic grows. PostgreSQL is documented as an option but not exercised in CI or runbook.
- **Impact:** Scale and reliability ceiling.

### C7. No global API rate limiting

- Only auth routes (forgot-password; login to be added) are rate-limited; rest of API is exposed to abuse.
- **Impact:** Operational safety at scale.

---

## 3. Highest-Leverage Opportunities (Remaining)

| # | Opportunity | User value | Scalability / team | Rationale |
|---|-------------|------------|--------------------|-----------|
| 1 | **Align PRODUCT_ROADMAP with reality** | Low (indirect) | High | Single source of truth; clearer prioritization. |
| 2 | **Rate limit login** | Low | High | Reduces brute-force; consistent with forgot-password. |
| 3 | **Optional body fat (OptionalMetrics) API + UI** | High | Medium | Completes optional spec; differentiates. |
| 4 | **Data export** | Medium | Low | Trust and portability; one endpoint. |
| 5 | **API integration tests** | Medium (indirect) | High | Safer refactors; catches route/middleware bugs. |
| 6 | **Email verification** | Medium | Medium | Deliverability and trust; reduces fake accounts. |
| 7 | **PostgreSQL runbook** | Low (when needed) | High | Clear path when scaling off SQLite. |
| 8 | **Global API rate limiting** | Low | Medium | Operational safety and fairness. |

---

## 4. Implementation Plan (Prioritized — Remaining Work)

### Immediate (next iteration)

#### 1. Align PRODUCT_ROADMAP with current state

- **Status:** Done. This document now reflects what the app does and what remains.
- **Remaining:** Keep this doc updated after each cycle.

#### 2. Rate limit login

- **Problem:** Login endpoint has no rate limit; brute-force possible.
- **Why it matters:** Security and consistency with forgot-password.
- **Difficulty:** Low.
- **Files:** `backend/src/routes/auth.ts`, `docs/DEPLOY.md`.
- **Implementation:** Add express-rate-limit for POST `/api/auth/login` (e.g. 10 req/15 min per IP). Document in deploy docs.

---

### Near-term (next 2–3 iterations)

#### 3. Optional body fat (OptionalMetrics) – API and UI

- **Problem:** Schema has OptionalMetric but no routes or UI.
- **Why it matters:** Completes optional spec; differentiates.
- **Difficulty:** Medium.
- **Files:** New routes e.g. `POST/GET /api/users/:id/optional-metrics`, backend types and validation; frontend types, API client, optional field in log form (collapsible), EntryHistory to show body fat when present.
- **Implementation:** CRUD or upsert by date for optional_metrics; validation body_fat_percent 0–100. Frontend: collapsible “Body fat %” in log form; display in history. Keep core entry/progress APIs unchanged.

#### 4. Data export (user data portability)

- **Problem:** Users cannot download their data.
- **Why it matters:** Trust and portability (e.g. GDPR-style).
- **Difficulty:** Low–Medium.
- **Files:** New GET `/api/users/:id/export` (requireAuth), return JSON (profile sanitized + entries + optional_metrics if implemented). Frontend: “Download my data” in Settings; trigger file download. Document in README or DEPLOY.

#### 5. API integration tests

- **Problem:** No tests that hit the real API with a real DB.
- **Why it matters:** Safer refactors; catches route and middleware bugs.
- **Difficulty:** Medium.
- **Files:** Backend test file(s) using Vitest, in-memory or file SQLite, app or fetch/supertest; cover POST users, POST login, GET/PATCH profile, POST/GET entries, GET progress. CI: run integration tests.
- **Implementation:** Minimal test DB; no separate server if app.listen in test. Assert status and key response shape.

#### 6. Email verification (phased)

- **Problem:** No email verification; fake or mistyped emails can create accounts.
- **Why it matters:** Deliverability and trust.
- **Difficulty:** Medium.
- **Files:** Schema (`emailVerifiedAt` or similar), send verification email on signup (reuse Resend), new verify-email endpoint; frontend message and link from email. Optional: gate password reset on verified email later.
- **Implementation:** Can phase: send verification email → verify endpoint → optional gating.

---

### Strategic (future roadmap)

#### 7. PostgreSQL runbook and optional switch

- **Problem:** Production scale and HA need a real DB; today only “change provider” is documented.
- **Why it matters:** Clear path when traffic or reliability demands it.
- **Difficulty:** Medium. Runbook in DEPLOY: clone schema for Postgres, migrations, env, backup. Optional: CI job against Postgres.

#### 8. Global API rate limiting

- **Problem:** Only auth routes rate-limited; rest of API exposed to abuse.
- **Why it matters:** Operational safety at scale.
- **Difficulty:** Low–Medium. Global middleware for `/api/*` (e.g. 100 req/15 min per IP); keep stricter limits on login and forgot-password. Document in deploy docs.

---

## 5. Success Criteria (Measurable Outcomes)

| Area | Indicator |
|------|------------|
| **Documentation** | PRODUCT_ROADMAP accurately describes current features and remaining gaps; team can prioritize from one source of truth. |
| **Security** | Login and auth flows are rate-limited; deploy docs describe limits. |
| **Completeness** | Users can optionally log and view body fat (OptionalMetrics) without disrupting core flow. |
| **Trust** | Users can export their data; optional email verification improves deliverability. |
| **Reliability** | API integration tests cover auth, entries, and progress; CI runs them. |
| **Scalability** | Runbook exists for PostgreSQL; optional global rate limit documented. |

---

## 6. Execution Ordering Summary

| When | Items |
|------|--------|
| **Immediate** | (1) PRODUCT_ROADMAP aligned, (2) Rate limit login. |
| **Near-term** | (3) Optional body fat API + UI, (4) Data export, (5) API integration tests, (6) Email verification (phased). |
| **Strategic** | (7) PostgreSQL runbook, (8) Global API rate limiting. |

---

## 7. Out of Scope for This Plan

- Actual payment or billing (plan field exists for future gating).
- Native mobile apps; PWA only if it fits later.
- Community, social, or multi-user features.
- Cosmetic or non–value-add refactors.

---

*Last updated to reflect current codebase: core value, auth, onboarding, retention, units, seed, tests, CI, deploy, and password reset are in place. Revisit after each implementation cycle.*
