export const UI_MOTION = {
  revealMs: 620,
  staggerMs: 55,
  maxStaggerMs: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export function revealDelay(index: number) {
  return Math.min(
    Math.max(0, Number.isFinite(index) ? index : 0) * UI_MOTION.staggerMs,
    UI_MOTION.maxStaggerMs,
  );
}
export function readingProgress(
  scroll: number,
  height: number,
  viewport: number,
) {
  const distance = height - viewport;
  return distance > 0 && Number.isFinite(distance) && Number.isFinite(scroll)
    ? Math.max(0, Math.min(1, scroll / distance))
    : 0;
}
export function pointerOffset(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return { x: 0, y: 0 };
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return {
    x: clamp((x / width) * 2 - 1) * 4,
    y: clamp((y / height) * 2 - 1) * 4,
  };
}
export function tripTransitionName(id: string) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) ? `trip-cover-${id}` : "none";
}
