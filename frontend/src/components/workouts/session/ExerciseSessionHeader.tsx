import type { WorkoutExerciseNested } from '../../../types/api';

function firstWorkingTargets(line: WorkoutExerciseNested): {
  setCount: number;
  repsLo: number | null;
  repsHi: number | null;
  rirLo: number | null;
  rirHi: number | null;
} {
  let repsLo: number | null = null;
  let repsHi: number | null = null;
  let rirLo: number | null = null;
  let rirHi: number | null = null;
  for (const s of line.sets) {
    if (s.set_role === 'top' || s.set_role === 'working' || s.set_role == null) {
      if (s.target_reps_min != null || s.target_reps_max != null) {
        repsLo = s.target_reps_min;
        repsHi = s.target_reps_max;
      }
      if (s.target_rir_min != null || s.target_rir_max != null) {
        rirLo = s.target_rir_min;
        rirHi = s.target_rir_max;
      }
      if (repsLo != null || repsHi != null || rirLo != null || rirHi != null) break;
    }
  }
  if (repsLo == null && repsHi == null && line.sets[0]) {
    const s = line.sets[0];
    repsLo = s.target_reps_min;
    repsHi = s.target_reps_max;
    rirLo = s.target_rir_min;
    rirHi = s.target_rir_max;
  }
  return { setCount: line.sets.length, repsLo, repsHi, rirLo, rirHi };
}

function formatTargetLine(line: WorkoutExerciseNested): string {
  const { setCount, repsLo, repsHi, rirLo, rirHi } = firstWorkingTargets(line);
  const parts: string[] = [];
  if (setCount > 0) parts.push(`${setCount} set${setCount === 1 ? '' : 's'}`);
  if (repsLo != null || repsHi != null) {
    parts.push(`${repsLo ?? '—'}–${repsHi ?? '—'} reps`);
  }
  if (rirLo != null || rirHi != null) {
    parts.push(`${rirLo ?? '—'}–${rirHi ?? '—'} RIR`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Log each set below.';
}

export interface ExerciseSessionHeaderProps {
  line: WorkoutExerciseNested;
  lastSessionLine: string;
  showSubstituted?: boolean;
}

export default function ExerciseSessionHeader({ line, lastSessionLine, showSubstituted }: ExerciseSessionHeaderProps) {
  return (
    <div className="exercise-session-header">
      <details className="exercise-session-header__collapsible" open aria-label="Targets and last session">
        <summary className="exercise-session-header__summary">Targets and last session</summary>
        <div className="exercise-session-header__panel">
          <p className="exercise-session-header__target progress-text">
            <span className="exercise-session-header__label">Target</span> {formatTargetLine(line)}
          </p>
          <p className="exercise-session-header__last progress-text">
            <span className="exercise-session-header__label">Last</span> {lastSessionLine}
          </p>
          {showSubstituted && line.substituted_from_exercise_id != null && (
            <p className="exercise-session-header__sub progress-text">Substitute session (tracked for history)</p>
          )}
        </div>
      </details>
    </div>
  );
}
