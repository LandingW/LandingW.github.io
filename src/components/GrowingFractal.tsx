"use client";

import { useEffect, useRef } from "react";
import { mountPrintMotion } from "@/lib/print-motion";

export default function GrowingFractal({
  study = "ink",
}: {
  study?: "ink" | "sand";
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.ResizeObserver) return;
    if (host.current) return mountPrintMotion(host.current);
  }, []);
  return (
    <div
      ref={host}
      className="page-fractal"
      data-renderer={study === "sand" ? "sand-ring-scroll" : "julia-ink-scroll"}
      data-art-motion="paused"
      aria-hidden="true"
    >
      <picture className="ink-static print-layer">
        <source
          media="(orientation: portrait)"
          srcSet={
            study === "sand"
              ? "/studies/sand-portrait.webp"
              : "/studies/ink-portrait.webp"
          }
        />
        {/* One precomputed responsive texture is also the complete no-JS fallback. */}
        <img
          src={
            study === "sand"
              ? "/studies/sand-landscape.webp"
              : "/studies/ink-landscape.webp"
          }
          alt=""
          width="1680"
          height="1400"
          decoding="async"
        />
      </picture>
    </div>
  );
}
