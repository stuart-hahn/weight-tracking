interface WorkoutSessionChromeProps {
  workoutName: string;
  statusLine?: string | null;
  completed: boolean;
  saving: boolean;
  onFinish: () => void;
  /** Clones the completed workout (same exercises/sets structure). */
  onRepeat: () => void;
}

export default function WorkoutSessionChrome({
  workoutName,
  statusLine,
  completed,
  saving,
  onFinish,
  onRepeat,
}: WorkoutSessionChromeProps) {
  return (
    <div className="workout-session-chrome">
      <div className="workout-session-chrome__inner">
        <div className="workout-session-chrome__title-wrap">
          <h2 className="workout-session-chrome__title">{workoutName}</h2>
          {statusLine ? <span className="workout-session-chrome__progress">{statusLine}</span> : null}
        </div>
        <div className="workout-session-chrome__actions">
          {completed ? (
            <button type="button" className="btn btn--primary btn--touch" disabled={saving} onClick={onRepeat}>
              Copy session
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
