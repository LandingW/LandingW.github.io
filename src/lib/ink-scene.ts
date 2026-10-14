import {
  inkBufferSize,
  INK_SURFACES,
  settleInkOffset,
  visibleInkSurfaces,
  type InkSurface,
} from "./ink-field";
import { createInkRenderer } from "./ink-renderer";
import { printScrollOffsets, type PrintScene } from "./print-motion";

export function createInkScene(
  host: HTMLDivElement,
  makeRenderer = createInkRenderer,
): PrintScene {
  const main = host.parentElement?.querySelector("main");
  const canvas = host.querySelector<HTMLCanvasElement>(".ink-live")!;
  const fallback = host.querySelector<HTMLImageElement>(".ink-static img")!;
  let renderer: ReturnType<typeof createInkRenderer> = null;
  let boxes: InkSurface[] = [],
    observed = new Set<Element>();
  let width = 0,
    height = 0,
    dead = false,
    failed = false,
    loaded = "";
  let camera: number | null = null;
  let notify = () => {};
  const reset = () => {
    delete host.dataset.fieldReady;
    camera = null;
  };
  const lost = (event: Event) => {
    event.preventDefault();
    failed = true;
    renderer?.dispose();
    renderer = null;
    loaded = "";
    reset();
  };
  const restored = () => {
    failed = false;
    notify();
  };
  const resized = new ResizeObserver(() => notify());
  const mutations = new MutationObserver(() => notify());
  const imageReady = () => {
    if (!dead) {
      loaded = "";
      notify();
    }
  };
  return {
    minFrameMs: 1000 / 30,
    observe(changed) {
      notify = changed;
      if (main) mutations.observe(main, { childList: true, subtree: true });
      canvas.addEventListener("webglcontextlost", lost);
      canvas.addEventListener("webglcontextrestored", restored);
      fallback.addEventListener("load", imageReady);
    },
    measure() {
      if (dead) return;
      width = window.innerWidth;
      height = host.clientHeight || window.innerHeight;
      const [w, h] = inkBufferSize(width, height, window.devicePixelRatio || 1);
      if (canvas.width !== w || canvas.height !== h) {
        delete host.dataset.fieldReady;
        canvas.width = w;
        canvas.height = h;
      }
      const nodes = [
        ...(main?.querySelectorAll<HTMLElement>(INK_SURFACES) || []),
      ];
      const next = new Set(nodes);
      observed.forEach((node) => {
        if (!next.has(node as HTMLElement)) resized.unobserve(node);
      });
      nodes.forEach((node) => {
        if (!observed.has(node)) resized.observe(node);
      });
      observed = next;
      boxes = nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            radius:
              parseFloat(getComputedStyle(node).borderTopLeftRadius) || 18,
          };
        })
        .filter((box) => box.width > 0 && box.height > 0);
    },
    draw(y, range, viewport) {
      if (
        dead ||
        failed ||
        !width ||
        !fallback.complete ||
        !fallback.naturalWidth
      )
        return;
      const source = fallback.currentSrc || fallback.src;
      try {
        if (!renderer) renderer = makeRenderer(canvas);
        if (!renderer) {
          failed = true;
          reset();
          return;
        }
        if (loaded !== source) {
          renderer.upload(fallback);
          loaded = source;
        }
        const settled = settleInkOffset(
          camera,
          printScrollOffsets(y, range, viewport)[0],
        );
        camera = settled.value;
        renderer.draw(
          width,
          height,
          camera,
          visibleInkSurfaces(boxes, y, height),
        );
        if (host.dataset.fieldReady !== "true")
          host.dataset.fieldReady = "true";
        return settled.moving;
      } catch {
        failed = true;
        renderer?.dispose();
        renderer = null;
        reset();
      }
    },
    reset,
    disconnect() {
      dead = true;
      resized.disconnect();
      mutations.disconnect();
      observed.clear();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      fallback.removeEventListener("load", imageReady);
      renderer?.dispose();
      renderer = null;
      reset();
    },
  };
}
