import {
  portraitRows,
  PORTRAIT_WIDTH,
  PORTRAIT_SPAN,
} from "./fractal-portrait";
import { buildTerrain, TERRAIN_STUDIES } from "./fractal-terrain";

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

export function buildFieldVariants(rows: number, portrait: boolean) {
  const height =
    (Number.isFinite(rows) ? Math.max(2, Math.floor(rows)) : 2) * PORTRAIT_SPAN;
  return TERRAIN_STUDIES.map((study) =>
    buildTerrain(
      study,
      portrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH,
      height,
      portrait,
    ),
  );
}
