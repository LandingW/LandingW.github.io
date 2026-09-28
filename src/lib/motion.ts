// Time-based exponential damping keeps interaction feel consistent across refresh rates.
export function approach(
  current: number,
  target: number,
  deltaMs: number,
  responseMs = 75,
): number {
  if (responseMs <= 0) return target;
  const elapsed = Math.max(0, Math.min(deltaMs, 64));
  return current + (target - current) * (1 - Math.exp(-elapsed / responseMs));
}

export const WARMUP_DURATION_MS = 2600;

// Shared progress for glyph reconstruction and the independent studio-light ramp.
export function warmupFrame(elapsedMs: number) {
  const t = Math.max(0, Math.min(1, elapsedMs / WARMUP_DURATION_MS));
  return {
    progress: t * t * (3 - 2 * t),
    done: t >= 1,
  };
}

export function headlineTiming(index: number) {
  return {
    delay: (index * 173 + 37) % 430,
    duration: 1150 + ((index * 239) % 550),
    pattern: index % 3,
  };
}
