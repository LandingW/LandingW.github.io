export type InkSurface = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};
export const INK_SURFACES =
  ".hero-copy, .hero-exhibit, .experience, .focus-item, .featured-article, .article-row, .home-trip, .education, .current-strip, .section-heading h2, .section-heading .eyebrow, .section-aside, .writing-links, .trip-card, .story-title-block, .journey-cover-note, .journey-equipment, .travel-atlas-layout, .journey-atlas-layout, .journey-section-heading h2, .journey-section-heading > p, .travel-intro > div";
export const MAX_INK_SURFACES = 6;

export function inkBufferSize(width: number, height: number, dpr: number) {
  const ratio = Math.min(
    Math.max(1, dpr),
    width < 600 ? 1 : 1.25,
    Math.sqrt(1_500_000 / Math.max(1, width * height)),
  );
  return [
    Math.max(1, Math.round(width * ratio)),
    Math.max(1, Math.round(height * ratio)),
  ];
}

export function visibleInkSurfaces(
  boxes: InkSurface[],
  y: number,
  height: number,
) {
  return boxes
    .filter((box) => box.y + box.height > y - 60 && box.y < y + height + 60)
    .slice(0, MAX_INK_SURFACES)
    .map((box) => ({ ...box, y: box.y - y }));
}

/** Settling has a finite final frame, not an idle render loop. */
export function settleInkOffset(current: number | null, target: number) {
  if (current === null || Math.abs(target - current) < 0.05)
    return { value: target, moving: false };
  return { value: current + (target - current) * 0.24, moving: true };
}
