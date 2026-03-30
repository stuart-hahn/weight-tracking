interface WorkoutSessionChromeProps {
  workoutName: string;
  completed: boolean;
  saving: boolean;
  guided: boolean;
  exerciseIndex: number;
  exerciseCount: number;
  onFinish: () => void;
  onRepeat: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function WorkoutSessionChrome({
  workoutName,
  completed,
  saving,
  guided,
  exerciseIndex,
  exerciseCount,
  onFinish,
  onRepeat,
  onPrev,
  onNext,
}: WorkoutSessionChromeProps) {
  const canStep = exerciseCount > 0;
  return (
    <div className="workout-session-chrome">
      <div className="workout-session-chrome__inner">
        <div className="workout-session-chrome__title-wrap">
          <h2 className="workout-session-chrome__title">{workoutName}</h2>
          {guided && canStep && (
            <span className="workout-session-chrome__progress">
              {exerciseIndex + 1} / {exerciseCount}
            </span>
          )}
        </div>
        <div className="workout-session-chrome__actions">
          {guided && canStep && !completed && (
            <>
              <button type="button" className="btn btn--secondary btn--touch" disabled={exerciseIndex <= 0} onClick={onPrev}>
                Prev
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--touch"
                disabled={exerciseIndex >= exerciseCount - 1}
                onClick={onNext}
              >
                Next
              </button>
            </>
          )}
          {completed ? (
            <button type="button" className="btn btn--primary btn--touch" disabled={saving} onClick={onRepeat}>
              Repeat
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--touch" disabled={saving} onClick={onFinish}>
              {saving ? 'Saving…' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
