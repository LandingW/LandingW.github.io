"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  UI_MOTION,
  pointerOffset,
  readingProgress,
  revealDelay,
} from "@/lib/ui-motion";

// Progressive enhancement only: without JS every paragraph and link is visible.
export default function SiteMotion() {
  const pathname = usePathname();
  useEffect(() => {
    if (
      !window.IntersectionObserver ||
      !window.ResizeObserver ||
      !HTMLElement.prototype.animate
    )
      return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const staticMode =
      new URLSearchParams(window.location.search).get("graphics") === "static";
    const pending = new Set<HTMLElement>();
    const seen = new WeakSet<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();
    let pointerFrame = 0,
      scrollFrame = 0;
    let card: HTMLElement | null = null;
    let pointer = { x: 0, y: 0 };
    const canAnimate = () =>
      !reduced.matches && !staticMode && !document.hidden;
    function finish(node: HTMLElement) {
      node.dataset.revealState = "visible";
      pending.delete(node);
      observer.unobserve(node);
      animations.get(node)?.cancel();
      animations.delete(node);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const node = entry.target as HTMLElement;
          finish(node);
          if (!canAnimate() || node.matches(":focus-within")) continue;
          const animation = node.animate(
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: UI_MOTION.revealMs,
              delay: revealDelay(Number(node.dataset.revealIndex || 0)),
              easing: UI_MOTION.easing,
              fill: "backwards",
            },
          );
          animations.set(node, animation);
          void animation.finished
            .then(() => {
              if (animations.get(node) === animation) {
                animation.cancel();
                animations.delete(node);
              }
            })
            .catch(() => {});
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" },
    );
    function collect(root: Element, add: boolean) {
      const nodes = [
        ...(root.matches("[data-reveal]") ? [root] : []),
        ...root.querySelectorAll("[data-reveal]"),
      ];
      for (const value of nodes) {
        const node = value as HTMLElement;
        if (!add) {
          finish(node);
          continue;
        }
        if (seen.has(node)) continue;
        seen.add(node);
        // Do not replay an entrance over content already visible at hydration,
        // or interfere with the existing headline warmup/shared-cover transition.
        if (
          !canAnimate() ||
          node.getBoundingClientRect().top < window.innerHeight - 24
        )
          continue;
        pending.add(node);
        node.dataset.revealState = "pending";
        observer.observe(node);
      }
    }
    function resetCard() {
      if (card) {
        card.style.removeProperty("--motion-x");
        card.style.removeProperty("--motion-y");
        card.style.removeProperty("--motion-zoom");
      }
      card = null;
    }
    function move(event: PointerEvent) {
      if (!canAnimate() || !fine.matches || event.pointerType !== "mouse")
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-motion-card]")
          : null;
      if (card !== target) {
        resetCard();
        card = target;
      }
      if (!card) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!card || !card.isConnected) return;
        const rect = card.getBoundingClientRect();
        const offset = pointerOffset(
          pointer.x - rect.left,
          pointer.y - rect.top,
          rect.width,
          rect.height,
        );
        card.style.setProperty("--motion-x", `${offset.x.toFixed(2)}px`);
        card.style.setProperty("--motion-y", `${offset.y.toFixed(2)}px`);
        card.style.setProperty("--motion-zoom", "1.04");
      });
    }
    function updateProgress() {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const progress = readingProgress(
          window.scrollY,
          document.documentElement.scrollHeight,
          window.innerHeight,
        );
        document
          .querySelector<HTMLElement>("[data-reading-progress]")
          ?.style.setProperty("--reading-progress", String(progress));
      });
    }
    function onScroll() {
      resetCard();
      updateProgress();
    }
    function preference() {
      document.documentElement.dataset.motion = canAnimate()
        ? "full"
        : "reduced";
      if (!canAnimate()) {
        pending.forEach(finish);
        animations.forEach((_animation, node) => finish(node));
      }
      if (!canAnimate() || !fine.matches) resetCard();
    }
    function focused(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      let node = event.target.closest<HTMLElement>("[data-reveal]");
      while (node) {
        finish(node);
        node =
          node.parentElement?.closest<HTMLElement>("[data-reveal]") || null;
      }
    }
    const changes = new MutationObserver((records) => {
      for (const record of records) {
        record.removedNodes.forEach((node) => {
          if (node instanceof Element) collect(node, false);
        });
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) collect(node, true);
        });
      }
      updateProgress();
    });
    const resize = new ResizeObserver(updateProgress);
    preference();
    collect(document.body, true);
    changes.observe(document.body, { childList: true, subtree: true });
    resize.observe(document.body);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", resetCard);
    document.addEventListener("focusin", focused);
    document.addEventListener("visibilitychange", preference);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    reduced.addEventListener("change", preference);
    fine.addEventListener("change", preference);
    updateProgress();
    return () => {
      changes.disconnect();
      resize.disconnect();
      pending.forEach(finish);
      animations.forEach((_animation, node) => finish(node));
      observer.disconnect();
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(scrollFrame);
      resetCard();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", resetCard);
      document.removeEventListener("focusin", focused);
      document.removeEventListener("visibilitychange", preference);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateProgress);
      reduced.removeEventListener("change", preference);
      fine.removeEventListener("change", preference);
    };
  }, [pathname]);
  return null;
}
