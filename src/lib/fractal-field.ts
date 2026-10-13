import {
  buildPortraitFractals,
  portraitRows,
  PORTRAIT_WIDTH,
} from "./fractal-portrait";
import type { FractalVariant } from "./fractal-growth";

export const LANDSCAPE_WIDTH = 1440;

export function fieldRows(
  width: number,
  viewport: number,
  document: number,
  portrait: boolean,
) {
  return portraitRows(
    (width * PORTRAIT_WIDTH) / (portrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH),
    viewport,
    document,
  );
}

export function buildFieldVariants(
  rows: number,
  portrait: boolean,
): FractalVariant[] {
  if (portrait) return buildPortraitFractals(rows);
  // Two full-height streams frame the content; their scale stays uniform and
  // their phase differs. Neither is repeated or reset at a viewport boundary.
  return buildPortraitFractals(Math.ceil(rows / 1.4) + 1).map((variant) => ({
    id: variant.id,
    strokes: [
      "translate(-65 0) scale(1.4)",
      "translate(1505 -280) scale(-1.4 1.4)",
    ].flatMap((layoutTransform, lane) => {
      const offset = lane * variant.strokes.length;
      return variant.strokes.map((stroke) => ({
        ...stroke,
        id: stroke.id + offset,
        parent: stroke.parent === null ? null : stroke.parent + offset,
        layoutTransform,
        opacity: stroke.opacity * (lane ? 0.8 : 1),
      }));
    }),
  }));
}
