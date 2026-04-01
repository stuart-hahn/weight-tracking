/** Pure plateau heuristic for exercise history (no DB). */

export interface PlateauHistoryRow {
  top_set_weight_kg: number | null;
  top_set_reps: number | null;
  avg_rir: number | null;
}

export function detectPlateau(rowsChronological: PlateauHistoryRow[]): {
  plateau: boolean;
  plateau_hint: string | null;
} {
  if (rowsChronological.length < 3) {
    return { plateau: false, plateau_hint: null };
  }
  const last3 = rowsChronological.slice(-3);
  const loads = last3.map((r) => r.top_set_weight_kg);
  const reps = last3.map((r) => r.top_set_reps);
  const rirs = last3.map((r) => r.avg_rir);

  const loadFlat =
    loads[0] != null &&
    loads[1] != null &&
    loads[2] != null &&
    loads[0] === loads[1] &&
    loads[1] === loads[2];
  const repsNotUp =
    reps[0] != null &&
    reps[1] != null &&
    reps[2] != null &&
    reps[2]! <= reps[1]! &&
    reps[1]! <= reps[0]!;

  if (loadFlat && repsNotUp) {
    return {
      plateau: true,
      plateau_hint: 'No increase in load or reps for three sessions in a row.',
    };
  }

  const rirRising =
    rirs[0] != null &&
    rirs[1] != null &&
    rirs[2] != null &&
    rirs[2]! > rirs[1]! &&
    rirs[1]! >= rirs[0]! &&
    loadFlat;
  if (rirRising) {
    return {
      plateau: true,
      plateau_hint: 'RIR trending up while load is flat—may indicate accumulated fatigue or need for adjustment.',
    };
  }

  return { plateau: false, plateau_hint: null };
}
