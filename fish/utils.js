// Shared utility helpers

/**
 * Returns a random float in [min, max).
 */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Normalizes an angle to the [-π, π] range.
 * Replaces the repeated while-loop pattern used throughout the codebase.
 */
export function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI)  a -= Math.PI * 2;
  return a;
}
