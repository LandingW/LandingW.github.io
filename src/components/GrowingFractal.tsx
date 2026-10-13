"use client";

import { useEffect, useRef } from "react";
import { buildPrint, PRINT_VIEWBOX, type PrintFormat } from "@/lib/print-study";
import { mountPrintMotion } from "@/lib/print-motion";

const prints = {
  landscape: buildPrint("landscape"),
  portrait: buildPrint("portrait"),
};

export default function GrowingFractal() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current) return mountPrintMotion(host.current);
  }, []);
  return (
    <div
      ref={host}
      className="page-fractal"
      data-renderer="composited-print"
      data-art-motion="paused"
      aria-hidden="true"
    >
      {[0, 1].map((layer) => (
        <div className={`print-layer print-layer--${layer}`} key={layer}>
          {(["landscape", "portrait"] as PrintFormat[]).map((format) => (
            <svg
              key={format}
              className={`print-art print-art--${format}`}
              viewBox={PRINT_VIEWBOX[format]}
              preserveAspectRatio="none"
              focusable="false"
              fill="none"
            >
              {prints[format][layer].map((form, index) => (
                <g
                  key={index}
                  stroke={form.ink}
                  strokeWidth={format === "portrait" ? 0.9 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d={form.curves[0]}
                    fill={form.ink}
                    fillOpacity=".045"
                    stroke="none"
                  />
                  {form.curves.map((d, ring) => (
                    <path
                      key={ring}
                      d={d}
                      strokeOpacity={ring % 5 === 0 ? 0.42 : 0.23}
                    />
                  ))}
                  <path
                    d={form.curves.at(-1)}
                    fill={form.ink}
                    fillOpacity=".075"
                    stroke="none"
                  />
                </g>
              ))}
            </svg>
          ))}
        </div>
      ))}
    </div>
  );
}
