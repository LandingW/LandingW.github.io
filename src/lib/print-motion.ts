/** Only lifecycle events, never a render loop or cursor/scroll handler. */
export function mountPrintMotion(host: HTMLDivElement) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const staticMode =
    new URLSearchParams(location.search).get("graphics") === "static";
  const update = () => {
    host.dataset.artMotion =
      document.hidden || reduced.matches || staticMode ? "paused" : "running";
  };
  update();
  document.addEventListener("visibilitychange", update);
  reduced.addEventListener("change", update);
  return () => {
    host.dataset.artMotion = "paused";
    document.removeEventListener("visibilitychange", update);
    reduced.removeEventListener("change", update);
  };
}
