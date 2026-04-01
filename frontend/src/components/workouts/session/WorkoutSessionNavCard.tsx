import { useState, useEffect } from 'react';
import type { WorkoutExerciseNested } from '../../../types/api';
import Dialog from '../../ui/Dialog';

const AUTO_REST_ON_DONE_KEY = 'workout-auto-rest-on-done';

function readAutoRestOnDone(): boolean {
  try {
    const v = localStorage.getItem(AUTO_REST_ON_DONE_KEY);
    if (v === null) return true;
    return v !== '0' && v !== 'false';
  } catch {
    return true;
  }
}

function writeAutoRestOnDone(on: boolean): void {
  try {
    localStorage.setItem(AUTO_REST_ON_DONE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

interface WorkoutSessionNavCardProps {
  lines: WorkoutExerciseNested[];
  /** When true, show compact Prev / count / Next / More (gym mode). */
  slimMode: boolean;
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
  slimMode,
  focusMode,
  focusExerciseIdx,
  onToggleFocusMode,
  onPrevExercise,
  onNextExercise,
  onJumpToExercise,
  onNextIncomplete,
}: WorkoutSessionNavCardProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [autoRestAfterDone, setAutoRestAfterDone] = useState(() => readAutoRestOnDone());

  useEffect(() => {
    setAutoRestAfterDone(readAutoRestOnDone());
  }, [moreOpen]);

  if (lines.length === 0) return null;

  const toggleAutoRest = (next: boolean) => {
    setAutoRestAfterDone(next);
    writeAutoRestOnDone(next);
  };

  if (slimMode) {
    return (
      <>
        <section className="app__card workout-session__session-bar" aria-label="Exercise navigation">
          <div className="workout-session__session-bar-inner">
            <button
              type="button"
              className="btn btn--secondary btn--sm btn--touch"
              disabled={focusExerciseIdx <= 0}
              onClick={onPrevExercise}
            >
              Prev
            </button>
            <span className="workout-session__session-bar-count" aria-live="polite">
              {focusExerciseIdx + 1} / {lines.length}
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--sm btn--touch"
              disabled={focusExerciseIdx >= lines.length - 1}
              onClick={onNextExercise}
            >
              Next
            </button>
            <button type="button" className="btn btn--secondary btn--sm btn--touch" onClick={() => setMoreOpen(true)}>
              More
            </button>
          </div>
        </section>

        <Dialog open={moreOpen} title="Session" onClose={() => setMoreOpen(false)} size="sm">
          <div className="workout-session__overflow-stack">
            <label className="workout-session__overflow-toggle">
              <input
                type="checkbox"
                checked={focusMode}
                onChange={(e) => onToggleFocusMode(e.target.checked)}
              />
              One exercise at a time
            </label>
            <label className="workout-session__overflow-toggle">
              <input type="checkbox" checked={autoRestAfterDone} onChange={(e) => toggleAutoRest(e.target.checked)} />
              Auto-start rest timer after Done
            </label>
            <p className="progress-text workout-session__overflow-hint">Jump to an exercise:</p>
            <nav className="workout-session__overflow-nav" aria-label="Jump to exercise">
              {lines.map((line, idx) => (
                <button
                  key={line.id}
                  type="button"
                  className="workout-session__overflow-link"
                  onClick={() => {
                    onJumpToExercise(line.id);
                    setMoreOpen(false);
                  }}
                >
                  <span className="workout-session__overflow-idx">{idx + 1}.</span> {line.exercise.name}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="btn btn--secondary btn--sm workout-session__overflow-next-inc"
              onClick={() => {
                onNextIncomplete();
                setMoreOpen(false);
              }}
            >
              Next incomplete set
            </button>
          </div>
        </Dialog>
      </>
    );
  }

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
