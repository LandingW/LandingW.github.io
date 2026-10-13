"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { FRACTAL_TIMING } from "@/lib/fractal-growth";
import {
  PORTRAIT_WIDTH,
  PORTRAIT_SPAN,
  PORTRAIT_SCROLL_RATE,
} from "@/lib/fractal-portrait";
import {
  buildFieldVariants,
  fieldRows,
  LANDSCAPE_WIDTH,
} from "@/lib/fractal-field";

export default function GrowingFractal() {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(":", "");
  const compact = useMediaQuery(
    "(max-width: 760px) and (orientation: portrait)",
  );
  const [rows, setRows] = useState(2);
  const variants = useMemo(
    () => buildFieldVariants(rows, compact),
    [compact, rows],
  );

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const size = () =>
      setRows(
        fieldRows(
          element.clientWidth,
          element.clientHeight,
          document.documentElement.scrollHeight,
          compact,
        ),
      );
    const observer = new ResizeObserver(size);
    observer.observe(document.body);
    observer.observe(element);
    size();
    return () => observer.disconnect();
  }, [compact]);

  // This loop runs only while the page is scrolling/resizing. Growth has its
  // own timeline, so a scroll never restarts the 2 / 1 / 2 second sequence.
  useEffect(() => {
    const element = ref.current;
    const track = element?.querySelector<HTMLElement>(".fractal-track");
    const tile = element?.querySelector<SVGSVGElement>(".fractal-field");
    if (!element || !track || !tile) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset =
        reducedMotion.matches || staticMode
          ? 0
          : -Math.max(0, window.scrollY) * PORTRAIT_SCROLL_RATE;
      track.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      element.dataset.parallax =
        reducedMotion.matches || staticMode ? "off" : "on";
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      schedule();
    });
    resize.observe(tile);
    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    reducedMotion.addEventListener("change", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      document.removeEventListener("visibilitychange", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, [compact]);

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const groups = variants.map((variant) => [
      ...element.querySelectorAll<SVGGElement>(
        `[data-fractal-pattern="${variant.id}"]`,
      ),
    ]);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    const animations = new Set<Animation>();
    let disposed = false,
      stopped = false,
      visible = true,
      current = Math.max(
        0,
        variants.findIndex(
          (variant) =>
            variant.id ===
            new URLSearchParams(window.location.search).get("fractal"),
        ),
      );
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
      groups.forEach((copies, index) => {
        copies.forEach((group) => {
          group.style.display = index === current ? "inline" : "none";
          group.style.opacity = "1";
        });
      });
      element.dataset.growth = "static";
      element.dataset.phase = "still";
      element.dataset.fractal = variants[current].id;
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
          const copies = groups[current],
            variant = variants[current];
          groups.forEach((items, index) => {
            items.forEach((item) => {
              item.style.display = index === current ? "inline" : "none";
              item.style.opacity = "1";
            });
          });
          element.dataset.fractal = variant.id;
          element.dataset.phase = "grow";
          copies.forEach((group) =>
            group
              .querySelectorAll(".fractal-contour")
              .forEach((path, index) => {
                const delay = Math.abs(variant.contours[index].level - 9) * 40;
                track(
                  path.animate(
                    [
                      { strokeDashoffset: "1", opacity: 0, offset: 0 },
                      { strokeDashoffset: ".94", opacity: 0.5, offset: 0.12 },
                      { strokeDashoffset: "0", opacity: 1, offset: 1 },
                    ],
                    {
                      delay,
                      duration: FRACTAL_TIMING.grow - delay,
                      fill: "both",
                      easing: "cubic-bezier(.25,.1,.25,1)",
                    },
                  ),
                );
              }),
          );
          copies.forEach((group) =>
            group.querySelectorAll(".fractal-wash").forEach((wash) => {
              track(
                wash.animate([{ opacity: 0 }, { opacity: 1 }], {
                  duration: FRACTAL_TIMING.grow,
                  fill: "both",
                  easing: "ease-in-out",
                }),
              );
            }),
          );
          await clock(copies[0], FRACTAL_TIMING.grow);
          if (disposed || stopped) return;
          element.dataset.phase = "hold";
          await clock(copies[0], FRACTAL_TIMING.hold);
          if (disposed || stopped) return;
          element.dataset.phase = "fade";
          const fades = copies.map((group) =>
            track(
              group.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: FRACTAL_TIMING.fade,
                fill: "forwards",
                easing: "ease-in-out",
              }),
            ),
          );
          await Promise.all(fades.map((fade) => fade.finished));
          if (disposed || stopped) return;
          copies.forEach((group) => {
            group.style.display = "none";
          });
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
  }, [variants]);

  return (
    <div
      ref={ref}
      className="page-fractal"
      data-composition={compact ? "portrait-terrain" : "landscape-terrain"}
      data-growth="booting"
      data-fractal="alluvial"
      data-phase="grow"
      aria-hidden="true"
    >
      <svg
        className="fractal-definitions"
        width="0"
        height="0"
        focusable="false"
      >
        <defs>
          {(["sage", "silt", "slate"] as const).map((tone) => (
            <linearGradient
              key={tone}
              id={`${id}-${tone}`}
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop stopColor={`var(--terrain-${tone})`} />
              <stop offset="1" stopColor={`var(--terrain-${tone}-soft)`} />
            </linearGradient>
          ))}
        </defs>
      </svg>
      <div className="fractal-track">
        <svg
          className="fractal-field"
          viewBox={`0 0 ${compact ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH} ${rows * PORTRAIT_SPAN}`}
          preserveAspectRatio="xMidYMin meet"
          focusable="false"
          fill="none"
        >
          {variants.map((variant, index) => (
            <g
              key={variant.id}
              data-fractal-pattern={variant.id}
              style={{ display: index === 0 ? "inline" : "none" }}
            >
              {variant.contours
                .filter((contour) => contour.closed && contour.level % 4 === 0)
                .map((contour) => (
                  <path
                    key={`wash-${contour.id}`}
                    className="fractal-wash"
                    d={contour.path}
                    fill={`url(#${id}-${contour.tone})`}
                    fillOpacity={0.035}
                  />
                ))}
              {variant.contours.map((contour) => (
                <path
                  key={contour.id}
                  className="fractal-contour"
                  d={contour.path}
                  pathLength={1}
                  strokeWidth={contour.weight}
                  strokeOpacity={contour.opacity}
                  stroke={`url(#${id}-${contour.tone})`}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <noscript>
        <style>
          {".page-fractal .fractal-contour{opacity:1;stroke-dasharray:none}"}
        </style>
      </noscript>
    </div>
  );
}
