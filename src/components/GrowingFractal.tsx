"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  buildFractalVariants,
  growthSchedule,
  FRACTAL_TIMING,
  fractalScrollOffset,
} from "@/lib/fractal-growth";
import {
  buildPortraitFractals,
  portraitRows,
  PORTRAIT_WIDTH,
  PORTRAIT_SPAN,
  PORTRAIT_SCROLL_RATE,
} from "@/lib/fractal-portrait";

const landscapeVariants = buildFractalVariants();

export default function GrowingFractal() {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(":", "");
  const compact = useMediaQuery(
    "(max-width: 760px) and (orientation: portrait)",
  );
  const [rows, setRows] = useState(2);
  const variants = useMemo(
    () => (compact ? buildPortraitFractals(rows) : landscapeVariants),
    [compact, rows],
  );

  useEffect(() => {
    if (!compact || !ref.current) return;
    const element = ref.current;
    const size = () =>
      setRows(
        portraitRows(
          element.clientWidth,
          element.clientHeight,
          document.documentElement.scrollHeight,
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
    const tile = element?.querySelector<SVGSVGElement>(
      ".fractal-tile, .fractal-field",
    );
    if (!element || !track || !tile) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    let frame = 0;
    let tileHeight = tile.getBoundingClientRect().height;
    const update = () => {
      frame = 0;
      const offset =
        reducedMotion.matches || staticMode
          ? 0
          : compact
            ? -Math.max(0, window.scrollY) * PORTRAIT_SCROLL_RATE
            : fractalScrollOffset(window.scrollY, tileHeight);
      track.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      element.dataset.parallax =
        reducedMotion.matches || staticMode ? "off" : "on";
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      tileHeight = tile.getBoundingClientRect().height;
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
      groups.forEach((copies, index) => {
        copies.forEach((group) => {
          group.style.display = index === current ? "inline" : "none";
          group.style.opacity = "1";
        });
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
          const schedule = growthSchedule(variant.strokes);
          copies.forEach((group) =>
            group.querySelectorAll("path").forEach((path, index) => {
              track(
                path.animate(
                  variant.strokes[index].continuous
                    ? [
                        {
                          strokeDasharray: "0 12",
                          strokeDashoffset: "0",
                          opacity: 0,
                        },
                        {
                          strokeDasharray: "12 0",
                          strokeDashoffset: "0",
                          opacity: 1,
                        },
                      ]
                    : [
                        { strokeDashoffset: "1", opacity: 0, offset: 0 },
                        { strokeDashoffset: ".98", opacity: 1, offset: 0.02 },
                        { strokeDashoffset: "0", opacity: 1, offset: 1 },
                      ],
                  { ...schedule[index], fill: "both", easing: "linear" },
                ),
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
                easing: "linear",
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
      data-composition={compact ? "portrait-continuous" : "landscape"}
      data-growth="booting"
      data-fractal="branching"
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
          <linearGradient id={`${id}-sage`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--fractal-ink)" />
            <stop offset="1" stopColor="var(--fractal-cool)" />
          </linearGradient>
          <linearGradient id={`${id}-clay`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--fractal-accent)" />
            <stop offset="1" stopColor="var(--fractal-gold)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="fractal-track">
        {Array.from({ length: compact ? 1 : 2 }, (_, tile) => (
          <svg
            className={compact ? "fractal-field" : "fractal-tile"}
            key={tile}
            viewBox={
              compact
                ? `0 0 ${PORTRAIT_WIDTH} ${rows * PORTRAIT_SPAN}`
                : "0 0 1440 760"
            }
            preserveAspectRatio={compact ? "xMidYMin meet" : "xMidYMid slice"}
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
                    pathLength={stroke.continuous ? undefined : 1}
                    data-continuous={stroke.continuous || undefined}
                    strokeWidth={stroke.width}
                    strokeOpacity={stroke.opacity}
                    stroke={`url(#${id}-${stroke.accent ? "clay" : "sage"})`}
                    fill={
                      variant.id === "sierpinski" && stroke.depth < 3
                        ? `url(#${id}-${stroke.accent ? "clay" : "sage"})`
                        : "none"
                    }
                    fillOpacity={0.06}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            ))}
          </svg>
        ))}
      </div>
      <noscript>
        <style>
          {".page-fractal .fractal-branch{opacity:1;stroke-dashoffset:0}"}
        </style>
      </noscript>
    </div>
  );
}
