"use client";

import { useEffect, useRef } from "react";
import { createInkScene } from "@/lib/ink-scene";
import { mountPrintMotion } from "@/lib/print-motion";

export default function GrowingFractal() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.ResizeObserver || !window.MutationObserver) return;
    if (host.current)
      return mountPrintMotion(host.current, createInkScene(host.current));
  }, []);
  return (
    <div
      ref={host}
      className="page-fractal"
      data-renderer="julia-ink-field"
      data-art-motion="paused"
      aria-hidden="true"
    >
      <picture className="ink-static">
        <source
          media="(orientation: portrait)"
          srcSet="/studies/ink-portrait.webp"
        />
        {/* One precomputed responsive texture is also the complete no-JS fallback. */}
        <img
          src="/studies/ink-landscape.webp"
          alt=""
          width="1680"
          height="1400"
          decoding="async"
        />
      </picture>
      <canvas className="ink-live" />
    </div>
  );
}
