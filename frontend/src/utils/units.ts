/**
 * Unit conversion and display for metric/imperial preference.
 * API and store remain in metric (kg, cm); convert only for display and input.
 */

import type { UnitsPreference } from '../types/api';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

/** Format inches as "X ft Y in" or "X in" */
export function formatInches(totalInches: number): string {
  const ft = Math.floor(totalInches / 12);
  const inRem = Math.round(totalInches % 12);
  if (ft > 0 && inRem > 0) return `${ft} ft ${inRem} in`;
  if (ft > 0) return `${ft} ft`;
  return `${inRem} in`;
}

function oneDecimal(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

/** Height in cm to display string (metric: "X cm", imperial: "X ft Y in") */
export function formatHeight(cm: number, units: UnitsPreference): string {
  if (units === 'imperial') {
    const totalInches = cmToIn(cm);
    return formatInches(totalInches);
  }
  return `${oneDecimal(cm)} cm`;
}

/** Weight in kg: 1 decimal for display */
function formatWeightKg(kg: number): string {
  return oneDecimal(kg);
}

/** Weight in kg to display string (metric: "X kg", imperial: "X lb" with one decimal) */
export function formatWeight(kg: number, units: UnitsPreference): string {
  if (units === 'imperial') {
    const lb = Math.round(kgToLb(kg) * 10) / 10;
    const lbStr = lb % 1 === 0 ? String(lb) : lb.toFixed(1);
    return `${lbStr} lb`;
  }
  return `${formatWeightKg(kg)} kg`;
}

/** Trend kg/week to display string (e.g. "-0.3 kg/week" or "-0.7 lb/week") */
export function formatTrend(kgPerWeek: number, units: UnitsPreference): string {
  const prefix = kgPerWeek >= 0 ? '+' : '';
  if (units === 'imperial') {
    const lbPerWeek = kgPerWeek / KG_PER_LB;
    const rounded = Math.round(lbPerWeek * 10) / 10;
    return `${prefix}${rounded} lb/week`;
  }
  const rounded = Math.round(kgPerWeek * 100) / 100;
  return `${prefix}${rounded} kg/week`;
}

/** Trend magnitude only (unsigned) for use with "Losing" / "Gaining" (e.g. "1.4 lb per week") */
export function formatTrendMagnitude(kgPerWeek: number, units: UnitsPreference): string {
  const abs = Math.abs(kgPerWeek);
  if (units === 'imperial') {
    const lbPerWeek = abs / KG_PER_LB;
    const rounded = Math.round(lbPerWeek * 10) / 10;
    return `${rounded} lb per week`;
  }
  const rounded = Math.round(abs * 100) / 100;
  return `${rounded} kg per week`;
}

/** Weekly weight change for summary (e.g. "−0.4 kg" or "−0.9 lb") */
export function formatWeightChange(kg: number, units: UnitsPreference): string {
  if (units === 'imperial') {
    const lb = Math.round(kgToLb(kg) * 10) / 10;
    const prefix = lb >= 0 ? '+' : '';
    return `${prefix}${lb} lb`;
  }
  const n = Math.round(kg * 100) / 100;
  const prefix = n >= 0 ? '+' : '';
  return `${prefix}${n} kg`;
}
