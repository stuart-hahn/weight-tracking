import { useEffect, useRef } from 'react';
import type { ExerciseListItem } from '../../../types/api';
import ExerciseCreateInline, { exerciseKindLabel } from '../../exercises/ExerciseCreateInline';

interface WorkoutExercisePickerCardProps {
  userId: string;
  open: boolean;
  onToggleOpen: () => void;
  search: string;
  onSearchChange: (next: string) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (next: boolean) => void;
  debouncedSearch: string;
  loading: boolean;
  showEmpty: boolean;
  hits: ExerciseListItem[];
  onPickExercise: (exerciseId: string) => void;
  onToggleFavorite: (exerciseId: string, nextIsFavorite: boolean) => void;
  onError?: (message: string | null) => void;
}

export default function WorkoutExercisePickerCard({
  userId,
  open,
  onToggleOpen,
  search,
  onSearchChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  debouncedSearch,
  loading,
  showEmpty,
  hits,
  onPickExercise,
  onToggleFavorite,
  onError,
}: WorkoutExercisePickerCardProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Focus after open without fighting layout/scroll.
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <section className="app__card">
      <h3 className="app__card-title">Add exercise</h3>
      <button type="button" className="btn btn--secondary" onClick={onToggleOpen}>
        {open ? 'Close picker' : 'Browse exercises'}
      </button>

      {open && (
        <div className="workout-session__picker">
          <label className="form-label workout-session__fav-toggle">
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => onFavoritesOnlyChange(e.target.checked)} />
            Favorites only
          </label>
          <input
            ref={searchInputRef}
            type="search"
            className="form-input workout-session__search"
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search exercises"
          />

          {loading && <p className="progress-text workout-session__picker-loading">Loading…</p>}

          {showEmpty && (
            <div className="workout-session__picker-empty" role="status">
              <p className="progress-text">No exercises match.</p>
              {favoritesOnly && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => onFavoritesOnlyChange(false)}>
                  Show all exercises
                </button>
              )}
              {debouncedSearch !== '' && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => onSearchChange('')}>
                  Clear search
                </button>
              )}
            </div>
          )}

          <ul className="workout-exercise-list workout-session__ex-list">
            {hits.map((ex) => (
              <li key={ex.id} className="workout-exercise-list__item">
                <button type="button" className="workout-exercise-list__pick" onClick={() => onPickExercise(ex.id)}>
                  <span>{ex.name}</span>
                  <span className="workout-exercise-list__meta">{exerciseKindLabel(ex.kind)}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch"
                  aria-label={ex.is_favorite ? 'Remove favorite' : 'Add favorite'}
                  onClick={() => onToggleFavorite(ex.id, !ex.is_favorite)}
                >
                  {ex.is_favorite ? '★' : '☆'}
                </button>
              </li>
            ))}
          </ul>

          <ExerciseCreateInline
            userId={userId}
            onCreated={(ex) => onPickExercise(ex.id)}
            {...(onError != null ? { onError } : {})}
            submitLabel="Create & add"
            className="workout-session__new-ex"
          />
        </div>
      )}
    </section>
  );
}

