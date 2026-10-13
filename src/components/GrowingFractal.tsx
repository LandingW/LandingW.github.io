"use client";

import { useEffect, useRef } from "react";
import { RIBBON_STUDIES } from "@/lib/ribbon-field";
import { mountTypographicField } from "@/lib/typographic-field";

export default function GrowingFractal() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (host.current && canvas.current)
      return mountTypographicField(host.current, canvas.current);
  }, []);
  return (
    <div
      ref={host}
      className="page-fractal"
      data-renderer="isolated-canvas"
      data-studies={RIBBON_STUDIES.join(" ")}
      data-growth="static"
      aria-hidden="true"
    >
      <svg
        className="fractal-fallback"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        focusable="false"
        fill="none"
      >
        <path
          d="M140 -200C-250 230 500 360 170 680S90 1030 230 1200"
          stroke="#a9beb0"
          strokeWidth="90"
          strokeOpacity=".2"
        />
        <path
          d="M870 -200C1160 210 520 530 840 810S990 1100 800 1200"
          stroke="#b7c7c8"
          strokeWidth="65"
          strokeOpacity=".16"
        />
      </svg>
      <canvas ref={canvas} className="fractal-canvas" />
    </div>
  );
}
