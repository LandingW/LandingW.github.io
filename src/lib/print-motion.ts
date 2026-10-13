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
export function mountPrintMotion(host: HTMLDivElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const staticMode =
    new URLSearchParams(location.search).get("graphics") === "static";
  const layers = [...host.querySelectorAll<HTMLElement>(".print-layer")];
  let frame = 0;
  let range = 0;
  let height = 0;
  let disposed = false;
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
  const draw = () => {
    frame = 0;
    if (canMove()) place(printScrollOffsets(window.scrollY, range, height));
  };
  const schedule = () => {
    if (canMove() && !frame) frame = requestAnimationFrame(draw);
  };
  const measure = () => {
    if (!canMove()) return;
    height = window.innerHeight;
    range = Math.max(0, document.documentElement.scrollHeight - height);
    schedule();
  };
  const update = () => {
    host.dataset.artMotion = canMove() ? "running" : "paused";
    if (canMove()) measure();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
      if (reduced.matches || staticMode) place([0, 0]);
    }
  };
  const resize = new ResizeObserver(measure);
  resize.observe(document.body);
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
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", measure);
    document.removeEventListener("visibilitychange", update);
    reduced.removeEventListener("change", update);
    layers.forEach((layer) => layer.style.removeProperty("translate"));
  };
}
