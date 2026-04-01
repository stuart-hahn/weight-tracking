# UX regression checklist (manual)

This is a lightweight, repeatable manual checklist to run after any UX refactor—especially around workouts (the highest-value flow).

## Global / navigation

- **Auth routing**: Logged-out users can see `/`, `/forgot-password`, `/reset-password`, `/verify-email` and are redirected away from logged-in routes.
- **Logged-in routing**: Logged-in users can reach `/log`, `/workouts`, `/workouts/:workoutId`, `/exercises`, `/workouts/programs`, `/progress`, `/settings`.
- **Nav active state**: Current section highlights correctly; tab order works; keyboard focus is visible.
- **Global banners/toasts**: Success/error messaging appears once (no render loops), and clearing works.

## Workouts hub (`/workouts`)

- **Loading state**: Shows a clear loading skeleton/spinner while fetching hub data.
- **Start fixed program day**: Clicking a day starts a workout and navigates to `/workouts/:id`.
- **Same program day again**: Only appears when last completed has `program_day_id`; starts the correct day.
- **More ways to start**: “Empty workout” starts a blank session; “Other program” picker works.
- **In-progress list**: In-progress workouts link to the correct session; completing a workout causes the hub list to refresh.

## Workout session (`/workouts/:workoutId`)

### Page-level
- **Load**: Session loads with exercises + sets; no unnecessary full refetch loops.
- **Outline / next incomplete**: Jump links scroll to the correct exercise; “Next incomplete” scrolls to the first incomplete set.
- **Focus mode (if enabled)**: Prev/Next works; the correct exercise is shown; disabling returns to full list.

### Exercise picker
- **Open/close**: Opening focuses search (without breaking mobile back/scroll); closing restores context.
- **Search**: Debounce works; empty state copy appears when there are no matches.
- **Favorites**: Toggle works and updates the list; state persists as designed.
- **Add exercise**: Adds the exercise to the workout without wiping existing edits; insights refresh appropriately.

### Set logging (per row)
- **Fast typing**: Weight/reps/RIR/duration inputs feel immediate and save correctly after idle and on blur.
- **Invalid values**: Invalid input shows inline feedback (not silent failure); no server spam.
- **Steppers**: +/- updates draft immediately; saved value matches.
- **Row save state**: “Saving…” / error appears at the row level; dismiss works.
- **Rest**: Rest hint is visible; rest timer opens; skip works with adequate touch target.

### Finish
- **Validation**: If incomplete sets exist, confirm/summary appears; completing succeeds.
- **Post-finish**: Session becomes read-only; hub/history updates (query invalidation) without requiring reload.

## Programs

- **Programs list**: Loads; fixed program is visible.
- **Program edit**: Editing a day/exercises/templates works; navigation back retains state.

## Progress / Log

- **Log entry**: Creating an entry works; errors are shown; success clears as expected.
- **Progress view**: Refresh trigger updates charts/metrics; loading/error states are clear.

