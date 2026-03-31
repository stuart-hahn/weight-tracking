/** Must match backend `FIXED_PROGRAM_NAME` in defaultFixedProgram.ts */
export const FIXED_PROGRAM_NAME = 'Fixed — Upper / Lower';

/** JS weekday: 0 Sun … 6 Sat → program `order_index` Mon=0 … Sat=5, or null Sunday (off). */
export function weekdayToFixedProgramDayOrderIndex(d: Date): number | null {
  const w = d.getDay();
  if (w === 0) return null;
  return w - 1;
}
