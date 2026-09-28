"use client";

import { useEffect, useRef } from "react";
import {
  buildFractalVariants,
  growthSchedule,
  FRACTAL_TIMING,
} from "@/lib/fractal-growth";

const variants = buildFractalVariants();

export default function GrowingFractal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const groups = [
      ...element.querySelectorAll<SVGGElement>("[data-fractal-pattern]"),
    ];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    const animations = new Set<Animation>();
    let disposed = false,
      stopped = false,
      visible = true,
      current = 0;
    const cancelAll = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const playing = () => visible && !document.hidden;
    const updatePlayback = () => {
      if (disposed || stopped) return;
      element.dataset.growth = playing() ? "cycling" : "paused";
      animations.forEach((animation) => {
        if (playing() && animation.playState === "paused") animation.play();
        else if (!playing() && animation.playState === "running")
          animation.pause();
      });
    };
    const track = (animation: Animation) => {
      animations.add(animation);
      // Navigation and reduced-motion changes deliberately cancel unfinished animations.
      void animation.finished.catch(() => {});
      if (!playing()) animation.pause();
      return animation;
    };
    const showStatic = () => {
      stopped = true;
      cancelAll();
      groups.forEach((group, index) => {
        group.style.display = index === current ? "inline" : "none";
        group.style.opacity = "1";
      });
      element.dataset.growth = "static";
      element.dataset.phase = "still";
    };
    async function clock(group: SVGGElement, duration: number) {
      const animation = track(group.animate([], { duration }));
      try {
        await animation.finished;
      } finally {
        animations.delete(animation);
        animation.cancel();
      }
    }
    async function cycle() {
      try {
        while (!disposed && !stopped) {
          const group = groups[current],
            variant = variants[current];
          groups.forEach((item, index) => {
            item.style.display = index === current ? "inline" : "none";
            item.style.opacity = "1";
          });
          element.dataset.fractal = variant.id;
          element.dataset.phase = "grow";
          const schedule = growthSchedule(variant.strokes);
          group.querySelectorAll("path").forEach((path, index) => {
            track(
              path.animate(
                [
                  { strokeDashoffset: "1", opacity: 0, offset: 0 },
                  { strokeDashoffset: ".98", opacity: 1, offset: 0.02 },
                  { strokeDashoffset: "0", opacity: 1, offset: 1 },
                ],
                { ...schedule[index], fill: "both", easing: "linear" },
              ),
            );
          });
          await clock(group, FRACTAL_TIMING.grow);
          if (disposed || stopped) return;
          element.dataset.phase = "hold";
          await clock(group, FRACTAL_TIMING.hold);
          if (disposed || stopped) return;
          element.dataset.phase = "fade";
          const fade = track(
            group.animate([{ opacity: 1 }, { opacity: 0 }], {
              duration: FRACTAL_TIMING.fade,
              fill: "forwards",
              easing: "linear",
            }),
          );
          await fade.finished;
          if (disposed || stopped) return;
          group.style.display = "none";
          cancelAll();
          current = (current + 1) % variants.length;
        }
      } catch {
        if (!disposed && !stopped) showStatic();
      }
    }
    const onPreferenceChange = () => {
      if (reducedMotion.matches) showStatic();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", updatePlayback);
    reducedMotion.addEventListener("change", onPreferenceChange);
    if (reducedMotion.matches || staticMode || !Element.prototype.animate)
      showStatic();
    else {
      updatePlayback();
      void cycle();
    }
    return () => {
      disposed = true;
      cancelAll();
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      reducedMotion.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="hero-fractal"
      data-growth="booting"
      data-fractal="branching"
      data-phase="grow"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 760"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        fill="none"
      >
        {variants.map((variant, index) => (
          <g
            key={variant.id}
            data-fractal-pattern={variant.id}
            style={{ display: index === 0 ? "inline" : "none" }}
          >
            {variant.strokes.map((stroke) => (
              <path
                key={stroke.id}
                className={
                  stroke.accent
                    ? "fractal-branch fractal-branch-accent"
                    : "fractal-branch"
                }
                d={stroke.path}
                pathLength={1}
                strokeWidth={stroke.width}
                strokeOpacity={stroke.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}
      </svg>
      <noscript>
        <style>
          {".hero-fractal .fractal-branch{opacity:1;stroke-dashoffset:0}"}
        </style>
      </noscript>
    </div>
  );
}
