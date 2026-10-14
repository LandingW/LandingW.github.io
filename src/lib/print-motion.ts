/** A small, reversible camera move across the whole document, without wrapping. */
export function printScrollOffsets(y: number, range: number, height: number) {
  if (![y, range, height].every(Number.isFinite) || range <= 0 || height <= 0)
    return [0, 0];
  const progress = Math.max(0, Math.min(1, y / range));
  const travel = Math.min(260, height * 0.32, range * 0.075);
  const offset = progress ? -progress * travel : 0;
  return [offset, offset * 0.62];
}

/** Scroll events share one pending frame; CSS handles the gentle settling.
 * No idle JS loop, cursor input, path updates or layout reads while scrolling.
 */
export interface PrintScene {
  minFrameMs?: number;
  observe(notify: () => void): void;
  measure(): void;
  draw(y: number, range: number, height: number): void;
  reset(): void;
  disconnect(): void;
}

export function mountPrintMotion(host: HTMLDivElement, scene?: PrintScene) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const staticMode =
    new URLSearchParams(location.search).get("graphics") === "static";
  const layers = [...host.querySelectorAll<HTMLElement>(".print-layer")];
  let frame = 0;
  let range = 0;
  let height = 0;
  let disposed = false;
  let lastDraw = -Infinity;
  const previous: string[] = [];
  const canMove = () =>
    !disposed && !document.hidden && !reduced.matches && !staticMode;
  const place = (offsets: number[]) => {
    layers.forEach((layer, i) => {
      const value = `0 ${(offsets[i] || 0).toFixed(2)}px`;
      if (previous[i] === value) return;
      layer.style.translate = value;
      previous[i] = value;
    });
  };
  const draw = (now: number) => {
    if (canMove() && now - lastDraw < (scene?.minFrameMs || 0)) {
      frame = requestAnimationFrame(draw);
      return;
    }
    frame = 0;
    if (canMove()) {
      lastDraw = now;
      place(printScrollOffsets(window.scrollY, range, height));
      scene?.draw(window.scrollY, range, height);
    }
  };
  const schedule = () => {
    if (canMove() && !frame) frame = requestAnimationFrame(draw);
  };
  const measure = () => {
    if (!canMove()) return;
    height = window.innerHeight;
    range = Math.max(0, document.documentElement.scrollHeight - height);
    scene?.measure();
    schedule();
  };
  const update = () => {
    host.dataset.artMotion = canMove() ? "running" : "paused";
    if (canMove()) measure();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
      if (reduced.matches || staticMode) {
        place([0, 0]);
        scene?.reset();
      }
    }
  };
  const resize = new ResizeObserver(measure);
  resize.observe(document.body);
  scene?.observe(measure);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  update();
  document.addEventListener("visibilitychange", update);
  reduced.addEventListener("change", update);
  return () => {
    disposed = true;
    host.dataset.artMotion = "paused";
    cancelAnimationFrame(frame);
    resize.disconnect();
    scene?.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", measure);
    document.removeEventListener("visibilitychange", update);
    reduced.removeEventListener("change", update);
    layers.forEach((layer) => layer.style.removeProperty("translate"));
  };
}
