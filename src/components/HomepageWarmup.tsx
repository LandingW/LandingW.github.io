"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { warmupFrame } from "@/lib/motion";

export default function HomepageWarmup({ children }: { children: ReactNode }) {
  const [finished, setFinished] = useState(false);
  const filters = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    const displacements =
      filters.current?.querySelectorAll("feDisplacementMap") ?? [];
    const densities = filters.current?.querySelectorAll("feFuncA") ?? [];
    let frame = 0,
      started: number | null = null,
      stopped = false;
    const apply = (progress: number) => {
      displacements.forEach((node) => {
        const amount = Number(node.getAttribute("data-amplitude"));
        node.setAttribute("scale", String(amount * (1 - progress) ** 2));
      });
      densities.forEach((node) =>
        node.setAttribute("intercept", String(-1.4 + 2.4 * progress ** 2)),
      );
    };
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      apply(1);
      setFinished(true);
    };
    const update = (time: number) => {
      if (stopped) return;
      if (started === null) started = time;
      const state = warmupFrame(time - started);
      apply(state.progress);
      if (state.done) finish();
      else frame = requestAnimationFrame(update);
    };
    const onPreferenceChange = () => {
      if (reducedMotion.matches) finish();
    };
    frame = requestAnimationFrame(
      reducedMotion.matches || staticMode ? finish : update,
    );
    document.addEventListener("pointerdown", finish, {
      once: true,
      capture: true,
    });
    document.addEventListener("keydown", finish, { once: true });
    document.addEventListener("wheel", finish, { once: true, passive: true });
    reducedMotion.addEventListener("change", onPreferenceChange);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", finish, true);
      document.removeEventListener("keydown", finish);
      document.removeEventListener("wheel", finish);
      reducedMotion.removeEventListener("change", onPreferenceChange);
    };
  }, []);
  return (
    <div
      className="home-page"
      data-headline-warmup={finished ? "ready" : "starting"}
      data-type-reveal={finished ? "ready" : "running"}
    >
      <svg
        ref={filters}
        className="text-reconstruction-defs"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {[
            {
              id: "headline-reconstruction",
              amplitude: 18,
              frequency: ".045 .10",
            },
            { id: "copy-reconstruction", amplitude: 2.8, frequency: ".20 .28" },
          ].map((filter) => (
            <filter
              id={filter.id}
              key={filter.id}
              x="-8%"
              y="-40%"
              width="116%"
              height="180%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={filter.frequency}
                numOctaves="2"
                seed="7"
                result="structure-noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="structure-noise"
                scale={filter.amplitude}
                data-amplitude={filter.amplitude}
                xChannelSelector="R"
                yChannelSelector="G"
                result="forming-glyphs"
              />
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".65"
                numOctaves="1"
                seed="19"
                result="grain"
              />
              <feColorMatrix
                in="grain"
                type="luminanceToAlpha"
                result="density"
              />
              <feComponentTransfer in="density" result="reconstruction-mask">
                <feFuncA type="linear" slope="4" intercept="-1.4" />
              </feComponentTransfer>
              <feComposite
                in="forming-glyphs"
                in2="reconstruction-mask"
                operator="in"
              />
            </filter>
          ))}
        </defs>
      </svg>
      {children}
    </div>
  );
}
