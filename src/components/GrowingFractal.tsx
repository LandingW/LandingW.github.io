"use client";

import { useEffect, useRef } from "react";
import { buildJuliaPlates } from "@/lib/julia-study";
import { createJuliaScene } from "@/lib/julia-surfaces";
import { mountPrintMotion } from "@/lib/print-motion";

const plates = buildJuliaPlates("landscape");

export default function GrowingFractal() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.ResizeObserver || !window.MutationObserver) return;
    if (host.current)
      return mountPrintMotion(host.current, createJuliaScene(host.current));
  }, []);
  return (
    <div
      ref={host}
      className="page-fractal"
      data-renderer="julia-surface-field"
      data-art-motion="paused"
      aria-hidden="true"
    >
      {plates.map((plate, layer) => (
        <div className={`print-layer print-layer--${layer}`} key={layer}>
          <picture className="julia-static">
            <source
              media="(orientation: portrait)"
              srcSet={`/studies/julia-portrait-${layer}.svg`}
            />
            {/* The mathematical artwork is an SVG, not a photo requiring Next image optimization. */}
            <img
              src={`/studies/julia-landscape-${layer}.svg`}
              alt=""
              width="1440"
              height="1000"
            />
          </picture>
          <svg
            className="julia-live"
            preserveAspectRatio="none"
            focusable="false"
            fillRule="evenodd"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {plate.bands.map((band, index) => (
              <path
                key={index}
                fill={plate.ink}
                fillOpacity={band.fill}
                stroke={plate.ink}
                strokeOpacity={band.stroke}
                strokeWidth=".7"
              />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}
