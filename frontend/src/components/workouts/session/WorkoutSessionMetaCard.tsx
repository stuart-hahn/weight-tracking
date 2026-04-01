import type { WorkoutDetailResponse } from '../../../types/api';

interface WorkoutSessionMetaCardProps {
  workout: WorkoutDetailResponse;
  completed: boolean;
  onNotesBlur: (notes: string) => void;
}

export default function WorkoutSessionMetaCard({ workout, completed, onNotesBlur }: WorkoutSessionMetaCardProps) {
  return (
    <section className="app__card workout-session__meta-card">
      {workout.training_week_index != null && (
        <p className="progress-text workout-session__week-hint">
          Block week {workout.training_week_index}
          {workout.is_deload_week ? ' · Deload' : ''}
        </p>
      )}
      <label className="form-label" htmlFor="workout-notes">
        Workout notes
      </label>
      <textarea
        id="workout-notes"
        className="form-input"
        rows={2}
        disabled={completed}
        defaultValue={workout.notes ?? ''}
        onBlur={(e) => onNotesBlur(e.target.value)}
        placeholder="Optional session notes"
      />
      <p className="progress-text workout-session__started">
        Started {new Date(workout.started_at).toLocaleString()}
        {completed && ` · Completed ${new Date(workout.completed_at!).toLocaleString()}`}
      </p>
    </section>
  );
}

