/**
 * Mesocycle week index from optional block start date (user.trainingBlockStartedAt).
 */

export function computeTrainingWeekIndex(blockStart: Date | null): number {
  if (!blockStart) return 1;
  const ms = Date.now() - blockStart.getTime();
  if (ms < 0) return 1;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function isDeloadWeek(weekIndex: number): boolean {
  return weekIndex > 0 && weekIndex % 6 === 0;
}

/** Approximate "every 4 weeks" calibration window */
export function isCalibrationWeek(weekIndex: number): boolean {
  return weekIndex > 0 && weekIndex % 4 === 0;
}
