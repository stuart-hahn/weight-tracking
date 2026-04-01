import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ExerciseListItem, WorkoutExerciseKind } from '../types/api';
import {
  listExercises,
  updateExercise,
  deleteExercise,
  duplicateExercise,
  addExerciseFavorite,
  removeExerciseFavorite,
} from '../api/client';
import ExerciseCreateInline, { exerciseKindLabel } from '../components/exercises/ExerciseCreateInline';
import InlineStatusCard from '../components/ui/InlineStatusCard';
import EmptyState from '../components/ui/EmptyState';
import SegmentedControl from '../components/ui/SegmentedControl';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Page from '../components/layout/Page';
import PageHeader from '../components/layout/PageHeader';

type FilterScope = 'all' | 'favorites' | 'custom';

interface ExercisesCatalogPageProps {
  userId: string;
  onError?: (message: string | null) => void;
  onSuccess?: (message: string | null) => void;
}

function sortByName(a: ExerciseListItem, b: ExerciseListItem): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function groupBySource(list: ExerciseListItem[]): { builtin: ExerciseListItem[]; mine: ExerciseListItem[] } {
  const builtin: ExerciseListItem[] = [];
  const mine: ExerciseListItem[] = [];
  for (const ex of list) {
    if (ex.is_custom) mine.push(ex);
    else builtin.push(ex);
  }
  builtin.sort(sortByName);
  mine.sort(sortByName);
  return { builtin, mine };
}

export default function ExercisesCatalogPage({ userId, onError, onSuccess }: ExercisesCatalogPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToRaw = searchParams.get('returnTo');
  const safeReturnTo =
    returnToRaw && returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : null;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scope, setScope] = useState<FilterScope>('all');
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState<WorkoutExerciseKind>('weight_reps');
  const [busyId, setBusyId] = useState<string | null>(null);
  const editNameRef = useRef<HTMLInputElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; ex: ExerciseListItem | null }>({ open: false, ex: null });

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 275);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const q = debouncedSearch || undefined;
      const list = await listExercises(userId, {
        ...(q ? { q } : {}),
        ...(scope === 'favorites' ? { favorites_only: true } : {}),
        ...(scope === 'custom' ? { custom_only: true } : {}),
      });
      setItems(list);
      onError?.(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load exercises';
      setLoadError(msg);
      onError?.(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, debouncedSearch, scope, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (_ex: ExerciseListItem) => {
    onSuccess?.('Exercise created.');
    if (safeReturnTo) {
      navigate(safeReturnTo);
      return;
    }
    void load();
  };

  const startEdit = (ex: ExerciseListItem) => {
    setEditingId(ex.id);
    setEditName(ex.name);
    setEditKind(ex.kind);
    requestAnimationFrame(() => editNameRef.current?.focus());
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const n = editName.trim();
    if (!n) return;
    setBusyId(editingId);
    try {
      await updateExercise(userId, editingId, { name: n, kind: editKind });
      setEditingId(null);
      onSuccess?.('Exercise updated.');
      await load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (ex: ExerciseListItem) => {
    setBusyId(ex.id);
    try {
      await deleteExercise(userId, ex.id);
      onSuccess?.('Exercise deleted.');
      await load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (ex: ExerciseListItem) => {
    setBusyId(ex.id);
    try {
      await duplicateExercise(userId, ex.id, {});
      onSuccess?.('Added to your exercises.');
      if (safeReturnTo) {
        navigate(safeReturnTo);
        return;
      }
      await load();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleFavorite = async (ex: ExerciseListItem) => {
    setBusyId(ex.id);
    try {
      if (ex.is_favorite) await removeExerciseFavorite(userId, ex.id);
      else await addExerciseFavorite(userId, ex.id);
      await load();
      onError?.(null);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Favorite failed');
    } finally {
      setBusyId(null);
    }
  };

  const { builtin, mine } = groupBySource(items);

  const renderRow = (ex: ExerciseListItem) => {
    const isEditing = editingId === ex.id;
    const busy = busyId === ex.id;

    if (isEditing) {
      const trimmed = editName.trim();
      const unchanged = trimmed === ex.name && editKind === ex.kind;
      return (
        <li key={ex.id} className="workout-exercise-list__item exercise-catalog__edit-row">
          <div className="exercise-catalog__edit-fields">
            <input
              ref={editNameRef}
              className="form-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit();
                if (e.key === 'Enter') void saveEdit();
              }}
              maxLength={120}
              disabled={busy}
            />
            <select
              className="form-input"
              value={editKind}
              onChange={(e) => setEditKind(e.target.value as WorkoutExerciseKind)}
              disabled={busy}
              aria-label="Kind"
            >
              <option value="weight_reps">Weight × reps</option>
              <option value="bodyweight_reps">Bodyweight reps</option>
              <option value="time">Time</option>
            </select>
          </div>
          <div className="exercise-catalog__edit-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy || trimmed === '' || unchanged}
              onClick={() => void saveEdit()}
            >
              Save
            </button>
            <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </li>
      );
    }

    return (
      <li key={ex.id} className="workout-exercise-list__item exercise-catalog__row">
        <div className="exercise-catalog__main">
          <span className="exercise-catalog__name">{ex.name}</span>
          <span className="workout-exercise-list__meta">{exerciseKindLabel(ex.kind)}</span>
        </div>
        <div className="exercise-catalog__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm btn--touch"
            aria-label={ex.is_favorite ? 'Remove favorite' : 'Add favorite'}
            disabled={busy}
            onClick={() => void toggleFavorite(ex)}
          >
            {ex.is_favorite ? '★' : '☆'}
          </button>
          {ex.is_custom ? (
            <>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={busy}
                onClick={() => startEdit(ex)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={busy}
                onClick={() => setConfirmDelete({ open: true, ex })}
              >
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={busy}
              onClick={() => void handleDuplicate(ex)}
            >
              Add to my exercises
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Exercises"
        description={<>Built-in exercises are read-only. Duplicate one to customize.</>}
        actions={
          safeReturnTo ? (
            <Link to={safeReturnTo} className="btn btn--secondary btn--sm">← Back</Link>
          ) : (
            <Link to="/workouts" className="btn btn--secondary btn--sm">← Workouts</Link>
          )
        }
      />

      <section className="app__card exercise-catalog">
        <ConfirmDialog
          open={confirmDelete.open && confirmDelete.ex != null}
          title="Delete exercise?"
          message={
            <>
              This will permanently delete <strong>{confirmDelete.ex?.name}</strong>. This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          busy={confirmDelete.ex ? busyId === confirmDelete.ex.id : false}
          onClose={() => {
            if (confirmDelete.ex && busyId === confirmDelete.ex.id) return;
            setConfirmDelete({ open: false, ex: null });
          }}
          onConfirm={() => {
            const ex = confirmDelete.ex;
            if (!ex) return;
            void handleDelete(ex).finally(() => setConfirmDelete({ open: false, ex: null }));
          }}
        />

        <ExerciseCreateInline
          userId={userId}
          onCreated={handleCreated}
          {...(onError != null ? { onError } : {})}
          submitLabel="Create exercise"
          className="exercise-catalog__create"
        />

        <SegmentedControl<FilterScope>
          value={scope}
          onChange={setScope}
          ariaLabel="Filter catalog"
          className="exercise-catalog__filters"
          options={[
            { value: 'all', label: 'All' },
            { value: 'favorites', label: 'Favorites' },
            { value: 'custom', label: 'My exercises' },
          ]}
        />

        <input
          type="search"
          className="form-input exercise-catalog__search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search exercises"
        />

        {loading ? (
          <p className="progress-text">Loading…</p>
        ) : loadError ? (
          <InlineStatusCard variant="error" title="Exercise catalog" message={loadError} actionLabel="Retry" onAction={() => void load()} />
        ) : (
          <>
            {builtin.length > 0 && (
              <div className="exercise-catalog__section">
                <h3 className="exercise-catalog__section-title">Built-in</h3>
                <ul className="workout-exercise-list exercise-catalog__list">{builtin.map(renderRow)}</ul>
              </div>
            )}
            {mine.length > 0 && (
              <div className="exercise-catalog__section">
                <h3 className="exercise-catalog__section-title">My exercises</h3>
                <ul className="workout-exercise-list exercise-catalog__list">{mine.map(renderRow)}</ul>
              </div>
            )}
            {builtin.length === 0 && mine.length === 0 && (
              <EmptyState
                message={debouncedSearch ? 'No exercises match your search and filters.' : 'No exercises match your filters.'}
                {...((scope !== 'all' || debouncedSearch) && {
                  actionLabel: 'Clear filters',
                  onAction: () => {
                    setScope('all');
                    setSearch('');
                  },
                })}
              />
            )}
          </>
        )}
      </section>
    </Page>
  );
}
