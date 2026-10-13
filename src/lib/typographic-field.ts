import {
  RIBBON_STUDIES,
  fieldBlend,
  glyphEnvelope,
  ribbonSamples,
  ribbonPigment,
  type GlyphAnchor,
  type ReadingAnchor,
} from "./ribbon-field";

const HEADING_SELECTOR =
  ".hero-title, .section-heading h2, #contact h2, .travel-intro h1, .story-title-block h1, .journey-section-heading h2";
export function mountTypographicField(
  host: HTMLDivElement,
  canvas: HTMLCanvasElement,
) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return () => {};
  // A smooth 1D pigment texture avoids translucent polygon overlap/seam lines.
  // These scratch canvases never enter the DOM and are allocated only once.
  const textures = [0, 1, 2].map((index) => {
    const texture = document.createElement("canvas");
    texture.width = 256;
    texture.height = 1;
    const paint = texture.getContext("2d")!;
    const gradient = paint.createLinearGradient(0, 0, 256, 0);
    for (let step = 0; step <= 64; step++)
      gradient.addColorStop(step / 64, ribbonPigment(index, -1 + step / 32));
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 256, 1);
    return texture;
  });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const staticMode =
    new URLSearchParams(location.search).get("graphics") === "static";
  let width = 0,
    height = 0,
    ratio = 1,
    frame = 0,
    elapsed = 2000,
    previous = 0,
    lastDraw = 0;
  let disposed = false,
    dirty = true,
    initialized = false,
    measured = false,
    surfaceVisible = true;
  let headings: HTMLElement[] = [];
  const pointer = { x: -1000, y: -1000, active: 0 };
  const targetPointer = { ...pointer };
  const focus: ReadingAnchor = { x: 0, y: 0, width: 0, height: 0, strength: 0 };
  let targetFocus = { ...focus },
    readingScroll = 0;
  const still = () => staticMode || reduced.matches;
  const root = host.parentElement!;

  function collectHeadings() {
    headings = [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)];
    dirty = true;
  }
  function measureLetters(element: HTMLElement) {
    const result: GlyphAnchor[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode()) && result.length < 64) {
      const text = node.textContent || "";
      for (let i = 0; i < text.length && result.length < 64; i++) {
        if (!text[i].trim()) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.height)
          result.push({
            x: rect.left + rect.width / 2,
            y: rect.top + scrollY + rect.height * 0.5,
            radius: Math.max(8, Math.min(rect.width, rect.height) * 0.52),
          });
      }
    }
    return result;
  }
  function measure() {
    const rect = host.getBoundingClientRect();
    const nextWidth = Math.round(rect.width),
      nextHeight = Math.round(rect.height);
    surfaceVisible = Boolean(nextWidth && nextHeight);
    if (!surfaceVisible) {
      dirty = false;
      return;
    }
    if (width !== nextWidth || height !== nextHeight) {
      width = nextWidth;
      height = nextHeight;
      ratio = Math.min(devicePixelRatio || 1, width < 760 ? 1.5 : 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      if (!measured) {
        focus.x = width * 0.5;
        focus.y = height * 0.45;
      }
    }
    let heading: HTMLElement | null = null,
      score = Infinity;
    for (const candidate of headings) {
      const r = candidate.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const distance = Math.abs(r.top + r.height / 2 - height * 0.38);
      if (distance < score) {
        score = distance;
        heading = candidate;
      }
    }
    if (heading) {
      const r = heading.getBoundingClientRect();
      const glyphs = measureLetters(heading).map((g) => ({
        ...g,
        y: g.y - scrollY,
      }));
      targetFocus = glyphEnvelope(glyphs, {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        width: r.width,
        height: r.height,
        strength: r.bottom > 70 && r.top < height * 0.9 ? 1 : 0,
      });
      host.dataset.fieldHeading =
        heading.getAttribute("aria-label") || heading.textContent?.trim() || "";
      host.dataset.linkedGlyphs = String(glyphs.length);
    } else {
      targetFocus.x = width * 0.5;
      targetFocus.y = height * 0.45;
      targetFocus.strength = 0;
    }
    dirty = false;
    measured = true;
  }

  function draw(time: number) {
    frame = 0;
    if (disposed || document.hidden) return;
    if (!still() && !dirty && time - lastDraw < 1000 / 30) {
      frame = requestAnimationFrame(draw);
      return;
    }
    const delta = previous ? Math.min(64, time - previous) : 1000 / 30;
    previous = time;
    lastDraw = time;
    if (dirty) measure();
    if (!width || !height || !surfaceVisible) return;
    if (!still()) elapsed += delta;
    const blend = fieldBlend(still() ? 2500 : elapsed);
    const smooth = still() || !initialized ? 1 : 1 - Math.exp(-delta / 200);
    for (const key of ["x", "y", "width", "height", "strength"] as const)
      focus[key] += (targetFocus[key] - focus[key]) * smooth;
    for (const key of ["x", "y", "active"] as const)
      pointer[key] += (targetPointer[key] - pointer[key]) * smooth;
    readingScroll += (scrollY - readingScroll) * smooth;
    context!.setTransform(1, 0, 0, 1, 0, 0);
    // Invariant opaque paper: no blank frames, retained trails, backdrop
    // sampling, DOM opacity changes, or shared UI render-target clearing.
    context!.fillStyle = "#f7f5ef";
    context!.fillRect(0, 0, canvas.width, canvas.height);
    // Three broad surfaces with a shaded cross-section, not many thin strokes.
    for (const index of [2, 1, 0]) {
      const samples = ribbonSamples(
        index,
        {
          width,
          height,
          elapsed: still() ? 2500 : elapsed,
          scroll: still() ? 0 : readingScroll,
          heading: still() ? { ...focus, strength: 0 } : focus,
          pointer: still() ? { ...pointer, active: 0 } : pointer,
        },
        width < 760 ? 72 : 96,
      );
      let segment = 0;
      // Adjacent physical-pixel scanlines: no gaps or overlapping alpha seams.
      for (let row = 0; row < canvas.height; row++) {
        const y = (row + 0.5) / ratio;
        while (segment < samples.length - 2 && samples[segment + 1].y < y)
          segment++;
        const a = samples[segment],
          b = samples[segment + 1];
        const t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
        const x = a.x + (b.x - a.x) * t;
        const radius = a.radius + (b.radius - a.radius) * t;
        const normal = a.nx + (b.nx - a.nx) * t;
        const extent = radius / Math.max(0.25, Math.abs(normal));
        context!.drawImage(
          textures[index],
          (x - extent) * ratio,
          row,
          extent * 2 * ratio,
          1,
        );
      }
    }
    initialized = true;
    const state = {
      ready: "true",
      growth: still() ? "static" : "morphing",
      phase: blend.phase,
      fractal: RIBBON_STUDIES[blend.to],
    };
    for (const [key, value] of Object.entries(state))
      if (host.dataset[key] !== value) host.dataset[key] = value;
    if (!still()) frame = requestAnimationFrame(draw);
  }

  function schedule() {
    if (!disposed && !document.hidden && !frame)
      frame = requestAnimationFrame(draw);
  }
  function layout() {
    dirty = true;
    schedule();
  }
  function move(event: PointerEvent) {
    if (still() || !fine.matches || event.pointerType !== "mouse") return;
    if (!targetPointer.active) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    targetPointer.x = event.clientX;
    targetPointer.y = event.clientY;
    targetPointer.active = 1;
    host.dataset.pointer = "active";
    schedule();
  }
  function leave() {
    targetPointer.active = 0;
    host.dataset.pointer = "idle";
    schedule();
  }
  function visibility() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    if (!document.hidden) {
      dirty = true;
      schedule();
    }
  }
  function preference() {
    initialized = false;
    previous = 0;
    dirty = true;
    leave();
    schedule();
  }
  const resize = new ResizeObserver(layout);
  resize.observe(host);
  resize.observe(root);
  const mutations = new MutationObserver((records) => {
    if (
      records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(
          (node) =>
            node instanceof Element &&
            (node.matches(HEADING_SELECTOR) ||
              node.querySelector(HEADING_SELECTOR)),
        ),
      )
    ) {
      collectHeadings();
      schedule();
    }
  });
  mutations.observe(root, { childList: true, subtree: true });
  collectHeadings();
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("scroll", layout, { passive: true });
  window.addEventListener("resize", layout, { passive: true });
  reduced.addEventListener("change", preference);
  fine.addEventListener("change", preference);
  void document.fonts.ready.then(() => {
    if (!disposed) layout();
  });
  schedule();
  return () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("scroll", layout);
    window.removeEventListener("resize", layout);
    reduced.removeEventListener("change", preference);
    fine.removeEventListener("change", preference);
  };
}
