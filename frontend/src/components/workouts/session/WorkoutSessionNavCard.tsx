import type { WorkoutExerciseNested } from '../../../types/api';

interface WorkoutSessionNavCardProps {
  lines: WorkoutExerciseNested[];
  focusMode: boolean;
  focusExerciseIdx: number;
  onToggleFocusMode: (next: boolean) => void;
  onPrevExercise: () => void;
  onNextExercise: () => void;
  onJumpToExercise: (lineId: string) => void;
  onNextIncomplete: () => void;
}

export default function WorkoutSessionNavCard({
  lines,
  focusMode,
  focusExerciseIdx,
  onToggleFocusMode,
  onPrevExercise,
  onNextExercise,
  onJumpToExercise,
  onNextIncomplete,
}: WorkoutSessionNavCardProps) {
  if (lines.length === 0) return null;

  return (
    <section className="app__card workout-session__nav-card">
      <div className="workout-session__focus-bar">
        <label className="workout-session__focus-toggle">
          <input type="checkbox" checked={focusMode} onChange={(e) => onToggleFocusMode(e.target.checked)} />
          Focus mode (one exercise at a time)
        </label>
        {focusMode && lines.length > 1 && (
          <div className="workout-session__focus-step">
            <button
              type="button"
              className="btn btn--secondary btn--sm btn--touch"
              disabled={focusExerciseIdx <= 0}
              onClick={onPrevExercise}
            >
              Prev exercise
            </button>
            <span className="workout-session__focus-count">
              {focusExerciseIdx + 1} / {lines.length}
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm btn--touch"
              disabled={focusExerciseIdx >= lines.length - 1}
              onClick={onNextExercise}
            >
              Next exercise
            </button>
          </div>
        )}
      </div>

      <details className="workout-session__outline">
        <summary className="workout-session__outline-summary">Exercises in this session</summary>
        <nav className="workout-session__outline-nav" aria-label="Jump to exercise">
          {lines.map((line, idx) => (
            <button
              key={line.id}
              type="button"
              className="workout-session__outline-link"
              onClick={() => onJumpToExercise(line.id)}
            >
              <span className="workout-session__outline-idx">{idx + 1}.</span> {line.exercise.name}
            </button>
          ))}
        </nav>
      </details>

      <button
        type="button"
        className="btn btn--secondary btn--sm workout-session__next-incomplete"
        onClick={onNextIncomplete}
      >
        Next incomplete set
      </button>
    </section>
  );
}

