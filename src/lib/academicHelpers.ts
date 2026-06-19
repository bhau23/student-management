/**
 * academicHelpers.ts
 *
 * Single source of truth for percentage-type computations used across
 * student dashboards, tutor dashboards, and the director's command center.
 * Adding a formula here = one place to fix if requirements change.
 */

/**
 * Attendance percentage: present / (present + absent) × 100
 * Pending-review sessions are excluded from the denominator.
 * Returns null when there are no reviewed sessions (avoids 0% misleading displays).
 */
export function calcAttendancePct(present: number, absent: number): number | null {
  const total = present + absent;
  if (total === 0) return null;
  return Math.round((present / total) * 100);
}

/**
 * Test percentage: marks / maxMarks × 100
 * Returns null when maxMarks is 0 (division guard).
 */
export function calcTestPct(marks: number, maxMarks: number): number | null {
  if (maxMarks <= 0) return null;
  return Math.round((marks / maxMarks) * 100);
}

/**
 * Average of an array of percentages. Returns null for empty arrays.
 */
export function avgPct(pcts: number[]): number | null {
  if (pcts.length === 0) return null;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}
