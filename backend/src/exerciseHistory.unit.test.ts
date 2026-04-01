import { describe, it, expect } from 'vitest';
import {
  detectPlateau,
  type PlateauHistoryRow,
} from './services/exerciseHistoryPlateau.js';

function row(partial: Partial<PlateauHistoryRow> & Pick<PlateauHistoryRow, 'top_set_weight_kg' | 'top_set_reps'>): PlateauHistoryRow {
  return {
    top_set_weight_kg: partial.top_set_weight_kg,
    top_set_reps: partial.top_set_reps,
    avg_rir: partial.avg_rir ?? null,
  };
}

describe('detectPlateau', () => {
  it('returns false when fewer than 3 sessions', () => {
    expect(detectPlateau([row({ top_set_weight_kg: 100, top_set_reps: 5 })]).plateau).toBe(false);
  });

  it('detects flat load and non-increasing reps', () => {
    const chronological = [
      row({ top_set_weight_kg: 100, top_set_reps: 8, avg_rir: 2 }),
      row({ top_set_weight_kg: 100, top_set_reps: 7, avg_rir: 2 }),
      row({ top_set_weight_kg: 100, top_set_reps: 7, avg_rir: 2 }),
    ];
    const r = detectPlateau(chronological);
    expect(r.plateau).toBe(true);
    expect(r.plateau_hint).toContain('three sessions');
  });

  it('returns false when reps increase', () => {
    const chronological = [
      row({ top_set_weight_kg: 100, top_set_reps: 6, avg_rir: 2 }),
      row({ top_set_weight_kg: 100, top_set_reps: 7, avg_rir: 2 }),
      row({ top_set_weight_kg: 100, top_set_reps: 8, avg_rir: 2 }),
    ];
    expect(detectPlateau(chronological).plateau).toBe(false);
  });
});
