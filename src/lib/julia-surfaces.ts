import {
  bendJuliaPoint,
  buildJuliaPlates,
  juliaPath,
  JULIA_VIEWBOX,
  type ArtPoint,
  type ArtSurface,
  type JuliaPlate,
} from "./julia-study";
import { printScrollOffsets, type PrintScene } from "./print-motion";

// Public reading surfaces only: never the editor, map internals or lightbox.
export const JULIA_SURFACES =
  ".hero-copy, .hero-exhibit, .experience, .focus-item, .featured-article, .article-row, .home-trip, .education, .current-strip, .section-heading, .trip-card, .story-title-block, .journey-cover-note, .journey-equipment, .travel-atlas-layout, .journey-atlas-layout, .journey-section-heading";

export function createJuliaScene(host: HTMLDivElement): PrintScene {
  const root = host.parentElement!;
  const main = root.querySelector("main");
  const svgs = [...host.querySelectorAll<SVGSVGElement>(".julia-live")];
  const paths = svgs.map((svg) => [...svg.querySelectorAll("path")]);
  let boxes: ArtSurface[] = [],
    plates: JuliaPlate[] = [];
  let width = 0,
    height = 0,
    dead = false;
  let changed = () => {};
  let observed = new Set<Element>();
  const resized = new ResizeObserver(() => changed());
  const mutations = new MutationObserver(() => changed());
  const previous = paths.map((row) => row.map(() => ""));

  return {
    minFrameMs: 1000 / 30,
    observe(notify) {
      changed = notify;
      if (main) mutations.observe(main, { childList: true, subtree: true });
    },
    measure() {
      if (dead) return;
      const w = window.innerWidth,
        h = window.innerHeight;
      if (w !== width || h !== height) {
        width = w;
        height = h;
        const format = h > w ? "portrait" : "landscape";
        const [vw, vh] = JULIA_VIEWBOX[format];
        plates = buildJuliaPlates(format).map((plate) => ({
          ...plate,
          bands: plate.bands.map((band) => ({
            ...band,
            loops: band.loops.map((loop) =>
              loop.map(([x, y]): ArtPoint => [(x * w) / vw, (y * h) / vh]),
            ),
          })),
        }));
        svgs.forEach((svg) => svg.setAttribute("viewBox", `0 0 ${w} ${h}`));
      }
      const nodes = [
        ...(main?.querySelectorAll<HTMLElement>(JULIA_SURFACES) || []),
      ];
      const next = new Set(nodes);
      observed.forEach((node) => {
        if (!next.has(node as HTMLElement)) resized.unobserve(node);
      });
      nodes.forEach((node) => {
        if (!observed.has(node)) resized.observe(node);
      });
      observed = next;
      // Measure only after layout/content changes. Scroll uses cached document coordinates.
      boxes = nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            radius:
              parseFloat(getComputedStyle(node).borderTopLeftRadius) || 22,
          };
        })
        .filter((box) => box.width > 0 && box.height > 0);
    },
    draw(y, range, viewport) {
      if (dead || !plates.length) return;
      const offsets = printScrollOffsets(y, range, viewport);
      // At most six visible paper surfaces participate, regardless of article/photo count.
      const active = boxes
        .filter((box) => box.y + box.height > y - 90 && box.y < y + height + 90)
        .slice(0, 6);
      plates.forEach((plate, layer) => {
        const surfaces = active.map((box) => ({
          ...box,
          y: box.y - y - offsets[layer],
        }));
        plate.bands.forEach((band, index) => {
          const d = juliaPath(band.loops, (point) =>
            bendJuliaPoint(point, surfaces, width < 600 ? 45 : 84),
          );
          if (previous[layer][index] === d) return;
          paths[layer][index].setAttribute("d", d);
          previous[layer][index] = d;
        });
      });
      if (host.dataset.fieldReady !== "true") host.dataset.fieldReady = "true";
    },
    reset() {
      delete host.dataset.fieldReady;
    },
    disconnect() {
      dead = true;
      resized.disconnect();
      mutations.disconnect();
      observed.clear();
      delete host.dataset.fieldReady;
    },
  };
}
