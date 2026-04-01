# Offline-first workout logging (deferred)

Full offline support is intentionally out of scope for the current iteration. A future epic should address:

- **Service worker** for asset shell and optional cached API responses.
- **IndexedDB (or similar) queue** for PATCH/POST operations with durable ordering.
- **Conflict model** when the same set is edited on two devices or after a long offline period (last-write-wins vs merge rules for `completed_at`, load, and reps).

Until then, the app assumes a live network and uses React Query against the REST API.
