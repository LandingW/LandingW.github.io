/** Original plotter studies: regular families of curves with bounded disorder.
 * Evaluated once, not per frame. No particles, physics, random seeds or DOM reads.
 */
type Point = { x: number; y: number };
export type PrintForm = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  angle: number;
  phase: number;
  ink: string;
  rings: number;
};
export const PRINT_PALETTE = {
  sage: "#658777",
  blue: "#768b9a",
  ochre: "#ba9065",
};
export const PRINT_VIEWBOX = {
  landscape: "0 0 1440 1000",
  portrait: "0 0 420 900",
};
export type PrintFormat = keyof typeof PRINT_VIEWBOX;

export function printForms(format: PrintFormat): PrintForm[][] {
  const p = PRINT_PALETTE;
  return format === "portrait"
    ? [
        [
          {
            x: 40,
            y: 195,
            rx: 168,
            ry: 223,
            angle: -0.24,
            phase: 0.4,
            ink: p.sage,
            rings: 13,
          },
          {
            x: 330,
            y: 865,
            rx: 171,
            ry: 196,
            angle: 0.5,
            phase: 1.9,
            ink: p.ochre,
            rings: 12,
          },
        ],
        [
          {
            x: 403,
            y: 490,
            rx: 155,
            ry: 250,
            angle: 0.3,
            phase: 2.3,
            ink: p.blue,
            rings: 15,
          },
        ],
      ]
    : [
        [
          {
            x: 165,
            y: 390,
            rx: 315,
            ry: 402,
            angle: -0.35,
            phase: 0.4,
            ink: p.sage,
            rings: 16,
          },
          {
            x: 820,
            y: 980,
            rx: 302,
            ry: 315,
            angle: 0.58,
            phase: 1.9,
            ink: p.ochre,
            rings: 14,
          },
        ],
        [
          {
            x: 1315,
            y: 250,
            rx: 330,
            ry: 435,
            angle: 0.42,
            phase: 2.3,
            ink: p.blue,
            rings: 18,
          },
        ],
      ];
}

/** Closed Catmull–Rom to cubic Bézier, including the final-to-first tangent. */
function closedCurve(points: Point[]) {
  const n = points.length,
    f = (v: number) => v.toFixed(1);
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n],
      b = points[i],
      c = points[(i + 1) % n],
      e = points[(i + 2) % n];
    d += `C${f(b.x + (c.x - a.x) / 6)} ${f(b.y + (c.y - a.y) / 6)} ${f(c.x - (e.x - b.x) / 6)} ${f(c.y - (e.y - b.y) / 6)} ${f(c.x)} ${f(c.y)}`;
  }
  return d + "Z";
}

export function printCurve(form: PrintForm, ring: number) {
  const progress =
    Math.max(0, Math.min(form.rings - 1, ring)) / Math.max(1, form.rings - 1);
  const radius = 1 - progress * 0.71;
  const c = Math.cos(form.angle),
    s = Math.sin(form.angle);
  return closedCurve(
    Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * Math.PI * 2;
      // Nested rounded squares loosen into organic curves, never a noisy line cloud.
      const wave =
        1 +
        0.028 * Math.sin(t * 3 + form.phase + progress * 0.8) +
        0.008 * Math.sin(t * 5 - form.phase);
      const x =
        form.rx *
        radius *
        Math.sign(Math.cos(t)) *
        Math.abs(Math.cos(t)) ** 0.36 *
        wave;
      const y =
        form.ry *
        radius *
        Math.sign(Math.sin(t)) *
        Math.abs(Math.sin(t)) ** 0.36 *
        wave;
      return {
        x: form.x + x * c - y * s + progress ** 2 * form.rx * 0.29,
        y: form.y + x * s + y * c - progress ** 2 * form.ry * 0.18,
      };
    }),
  );
}

export function buildPrint(format: PrintFormat) {
  return printForms(format).map((layer) =>
    layer.map((form) => ({
      ink: form.ink,
      curves: Array.from({ length: form.rings }, (_, ring) =>
        printCurve(form, ring),
      ),
    })),
  );
}
