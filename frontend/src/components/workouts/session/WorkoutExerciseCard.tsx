import type { UnitsPreference, WorkoutExerciseNested } from '../../../types/api';
import WorkoutSetRow from '../WorkoutSetRow';
import { exerciseKindLabel } from '../../exercises/ExerciseCreateInline';
import WorkoutInsights from './WorkoutInsights';

interface WorkoutExerciseCardProps {
  line: WorkoutExerciseNested;
  completed: boolean;
  fromProgram: boolean;
  focusHidden: boolean;
  removeConfirmActive: boolean;
  onRequestRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  insights?: { last: string; suggestion: string; variant?: string };
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
}: WorkoutExerciseCardProps) {
  return (
    <section
      key={line.id}
      id={`workout-ex-${line.id}`}
      className={`app__card workout-session__ex-card${focusHidden ? ' workout-session__ex-card--hidden' : ''}`}
    >
      <div className="workout-session__ex-header">
        <h3 className="app__card-title workout-session__ex-title">{line.exercise.name}</h3>
        <span className="workout-kind-badge">{exerciseKindLabel(line.exercise.kind)}</span>
        {!completed && !fromProgram && (
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
              <button type="button" className="btn btn--secondary btn--sm btn--touch workout-session__remove-ex" onClick={onRequestRemove}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {line.notes != null && line.notes.trim() !== '' && <ProgramExerciseNotes text={line.notes} fromProgram={fromProgram} />}

      {insights && (
        <WorkoutInsights
          last={insights.last}
          suggestion={insights.suggestion}
          {...(insights.variant != null ? { variant: insights.variant } : {})}
          humanizeVariant={humanizeVariant}
        />
      )}

      <div className="workout-sets">
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
    </section>
  );
}

