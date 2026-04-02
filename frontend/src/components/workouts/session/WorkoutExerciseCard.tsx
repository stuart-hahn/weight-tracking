import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { UnitsPreference, WorkoutExerciseNested } from '../../../types/api';
import WorkoutSetRow from '../WorkoutSetRow';
import { exerciseKindLabel } from '../../exercises/ExerciseCreateInline';
import WorkoutInsights from './WorkoutInsights';
import ExerciseSessionHeader from './ExerciseSessionHeader';
import Dialog from '../../ui/Dialog';
import { listExerciseSubstitutions } from '../../../api/client';

interface WorkoutExerciseCardProps {
  line: WorkoutExerciseNested;
  completed: boolean;
  fromProgram: boolean;
  focusHidden: boolean;
  removeConfirmActive: boolean;
  onRequestRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  insights?: { last: string; suggestion: string; variant?: string } | null;
  humanizeVariant: (v: string) => string;
  units: UnitsPreference;
  displayWeight: (kg: number | null) => string;
  parseWeightInput: (raw: string) => number | null;
  onPatchSet: (setId: string, patch: Record<string, unknown>) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  canDeleteSet: (setCount: number) => boolean;
  onRest: (sec: number) => void;
  isPatchingSetId: string | null;
  patchErrorBySetId: Record<string, string>;
  onDismissPatchError: (setId: string) => void;
  ProgramExerciseNotes: (props: { text: string; fromProgram: boolean }) => JSX.Element;
  /** Gym mode: History / Substitute / Remove behind one "Exercise" menu. */
  compactHeaderActions?: boolean;
  userId: string;
  focusRepsSetId: string | null;
  onDoneCommitted: (lineId: string, setId: string) => void;
  onRestAfterSetDone: (seconds: number) => void;
  onSubstituteExercise: (lineId: string, substituteExerciseId: string) => Promise<void>;
}

export default function WorkoutExerciseCard({
  line,
  completed,
  fromProgram,
  focusHidden,
  removeConfirmActive,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
  insights,
  humanizeVariant,
  units,
  displayWeight,
  parseWeightInput,
  onPatchSet,
  onAddSet,
  onDeleteSet,
  canDeleteSet,
  onRest,
  isPatchingSetId,
  patchErrorBySetId,
  onDismissPatchError,
  ProgramExerciseNotes,
  compactHeaderActions = false,
  userId,
  focusRepsSetId,
  onDoneCommitted,
  onRestAfterSetDone,
  onSubstituteExercise,
}: WorkoutExerciseCardProps) {
  const [exMenuOpen, setExMenuOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subRows, setSubRows] = useState<{ substitute_exercise_id: string; name: string }[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  const loadSubs = useCallback(async () => {
    setSubLoading(true);
    setSubError(null);
    try {
      const rows = await listExerciseSubstitutions(userId, line.exercise_id);
      setSubRows(rows.map((r) => ({ substitute_exercise_id: r.substitute_exercise_id, name: r.name })));
    } catch (e) {
      setSubError(e instanceof Error ? e.message : 'Failed to load substitutes');
      setSubRows([]);
    } finally {
      setSubLoading(false);
    }
  }, [userId, line.exercise_id]);

  useEffect(() => {
    if (subOpen) void loadSubs();
  }, [subOpen, loadSubs]);

  const kind = line.exercise.kind;
  const showKindCol = kind !== 'time';

  const nextIncompleteSetId = useMemo(() => {
    if (completed) return null;
    const s = line.sets.find((x) => x.completed_at == null);
    return s?.id ?? null;
  }, [completed, line.sets]);

  return (
    <section
      key={line.id}
      id={`workout-ex-${line.id}`}
      className={`app__card workout-session__ex-card${focusHidden ? ' workout-session__ex-card--hidden' : ''}`}
    >
      <div className="workout-session__ex-header">
        <h3 className="app__card-title workout-session__ex-title">{line.exercise.name}</h3>
        <span className="workout-kind-badge">{exerciseKindLabel(line.exercise.kind)}</span>
        <div className="workout-session__ex-header-actions">
          {compactHeaderActions ? (
            <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={() => setExMenuOpen(true)}>
              Exercise
            </button>
          ) : (
            <>
              <Link to={`/exercises/${line.exercise_id}/history`} className="btn btn--secondary btn--sm btn--touch">
                History
              </Link>
              {!completed && !fromProgram && (
                <>
                  <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={() => setSubOpen(true)}>
                    Substitute
                  </button>
                  <div className="workout-session__remove-wrap">
                    {removeConfirmActive ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex"
                          onClick={onConfirmRemove}
                        >
                          Confirm remove
                        </button>
                        <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={onCancelRemove}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex"
                        onClick={onRequestRemove}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {compactHeaderActions && removeConfirmActive && !fromProgram && (
        <div className="workout-session__ex-remove-strip" role="status">
          <span className="workout-session__ex-remove-strip-label">Remove this exercise?</span>
          <div className="workout-session__ex-remove-strip-actions">
            <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={onConfirmRemove}>
              Confirm remove
            </button>
            <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={onCancelRemove}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {line.notes != null && line.notes.trim() !== '' && <ProgramExerciseNotes text={line.notes} fromProgram={fromProgram} />}

      <ExerciseSessionHeader
        line={line}
        lastSessionLine={insights?.last ?? '—'}
        showSubstituted={!completed}
      />
      {insights && (
        <WorkoutInsights
          last=""
          suggestion={insights.suggestion}
          {...(insights.variant != null ? { variant: insights.variant } : {})}
          humanizeVariant={humanizeVariant}
          hideLast
        />
      )}

      <div className="workout-sets workout-sets--table">
        <div
          className={
            kind === 'time'
              ? 'workout-set-row__table-grid workout-set-row__table-grid--time workout-set-row__table-head'
              : kind === 'bodyweight_reps'
                ? 'workout-set-row__table-grid workout-set-row__table-grid--bw workout-set-row__table-head'
                : 'workout-set-row__table-grid workout-set-row__table-grid--weight workout-set-row__table-head'
          }
          aria-hidden
        >
          <span className="workout-set-row__set-num">Set</span>
          <span className="workout-set-row__th">{kind === 'time' ? 'Sec' : kind === 'bodyweight_reps' ? '—' : units === 'imperial' ? 'lb' : 'kg'}</span>
          {kind !== 'time' && <span className="workout-set-row__th">Reps</span>}
          {kind === 'weight_reps' && <span className="workout-set-row__th">RIR</span>}
          {showKindCol && <span className="workout-set-row__th">Kind</span>}
          <span className="workout-set-row__th">Done</span>
          <span className="workout-set-row__th workout-set-row__th--actions">Rest / actions</span>
        </div>

        {line.sets.map((set) => {
          const allowDelete = !completed && !fromProgram && canDeleteSet(line.sets.length);
          const deleteHandler = allowDelete ? () => onDeleteSet(set.id) : undefined;
          return (
            <WorkoutSetRow
              key={set.id}
              line={line}
              set={{
                ...set,
                rir: set.rir ?? null,
                set_role: set.set_role ?? null,
                target_reps_min: set.target_reps_min ?? null,
                target_reps_max: set.target_reps_max ?? null,
                target_rir_min: set.target_rir_min ?? null,
                target_rir_max: set.target_rir_max ?? null,
                calibration_to_failure: set.calibration_to_failure ?? false,
                completed_at: set.completed_at ?? null,
                set_kind: set.set_kind ?? null,
                actual_rest_seconds: set.actual_rest_seconds ?? null,
              }}
              units={units}
              completed={completed}
              displayWeight={displayWeight}
              parseWeightInput={parseWeightInput}
              onPatch={(patch) => onPatchSet(set.id, patch as Record<string, unknown>)}
              onRest={onRest}
              canDeleteSet={allowDelete}
              hideSetNote={fromProgram}
              isPatching={isPatchingSetId === set.id}
              patchError={patchErrorBySetId[set.id] ?? null}
              onDismissPatchError={() => onDismissPatchError(set.id)}
              focusReps={focusRepsSetId === set.id}
              onDoneCommitted={(setId) => onDoneCommitted(line.id, setId)}
              onRestAfterSetDone={onRestAfterSetDone}
              isNextIncomplete={nextIncompleteSetId === set.id}
              {...(deleteHandler ? { onDelete: deleteHandler } : {})}
            />
          );
        })}

        {!completed && (
          <button type="button" className="btn btn--secondary workout-session__add-set" disabled={fromProgram} onClick={onAddSet}>
            Add set
          </button>
        )}
      </div>

      <Dialog open={exMenuOpen} title="Exercise" onClose={() => setExMenuOpen(false)} size="sm">
        <ul className="workout-session__overflow-list">
          <li>
            <Link
              to={`/exercises/${line.exercise_id}/history`}
              className="btn btn--secondary btn--sm btn--touch workout-session__overflow-list-btn"
              onClick={() => setExMenuOpen(false)}
            >
              History
            </Link>
          </li>
          {!completed && !fromProgram && (
            <>
              <li>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch workout-session__overflow-list-btn"
                  onClick={() => {
                    setExMenuOpen(false);
                    setSubOpen(true);
                  }}
                >
                  Substitute
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--touch workout-session__overflow-list-btn workout-session__remove-ex"
                  onClick={() => {
                    onRequestRemove();
                    setExMenuOpen(false);
                  }}
                >
                  Remove
                </button>
              </li>
            </>
          )}
        </ul>
      </Dialog>

      <Dialog
        open={subOpen}
        title="Substitute exercise"
        description={
          <>
            Pick a saved substitute for <strong>{line.exercise.name}</strong>. Sets reset to one empty row; manage the list in{' '}
            <Link to="/exercises" onClick={() => setSubOpen(false)}>
              Exercises
            </Link>
            .
          </>
        }
        onClose={() => setSubOpen(false)}
        size="sm"
      >
        {subLoading && <p className="progress-text">Loading…</p>}
        {subError && <p className="progress-text">{subError}</p>}
        {!subLoading && !subError && subRows.length === 0 && (
          <p className="progress-text">No substitutes yet. Add them from the catalog for this exercise.</p>
        )}
        <ul className="workout-substitute-list">
          {subRows.map((r) => (
            <li key={r.substitute_exercise_id}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                disabled={subBusy}
                onClick={() => {
                  setSubBusy(true);
                  void onSubstituteExercise(line.id, r.substitute_exercise_id)
                    .then(() => setSubOpen(false))
                    .finally(() => setSubBusy(false));
                }}
              >
                Use {r.name}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </section>
  );
}
