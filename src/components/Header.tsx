"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { navSections } from "@/lib/resume";
import { Arrow } from "./Icons";
import FractalMark from "./FractalMark";
import { useMediaQuery } from "@/lib/use-media-query";

function placeIndicator(nav: HTMLElement | null, link: HTMLElement | null) {
  if (!nav) return;
  if (!link || window.matchMedia("(max-width: 760px)").matches) {
    nav.style.setProperty("--nav-visible", "0");
    return;
  }
  nav.style.setProperty("--nav-left", `${link.offsetLeft - 10}px`);
  nav.style.setProperty("--nav-width", `${link.offsetWidth + 20}px`);
  nav.style.setProperty("--nav-visible", "1");
}

export default function Header({
  article = false,
  travel = false,
}: {
  article?: boolean;
  travel?: boolean;
}) {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const mobile = useMediaQuery("(max-width: 760px)");
  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const measure = () =>
      placeIndicator(element, element.querySelector<HTMLElement>(".is-active"));
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    measure();
    return () => resize.disconnect();
  }, [active, article, travel, mobile]);

  useEffect(() => {
    if (article || travel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    ["home", ...navSections.map((section) => section.id)].forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [article, travel]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/#home" className="brand" aria-label="Land1ngW 首页">
          <FractalMark depth={2} className="brand-mark" />
          <span className="brand-name">
            Land1ngW<span className="accent">.</span>
          </span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? "关闭导航" : "打开导航"}
          aria-expanded={open}
          aria-controls="main-nav"
          data-open={open}
          onClick={() => setOpen(!open)}
        >
          <span>{open ? "关闭" : "菜单"}</span>
          <span className="menu-toggle-mark" aria-hidden="true">
            +
          </span>
        </button>
        <nav
          id="main-nav"
          ref={nav}
          inert={mobile && !open}
          className={`main-nav ${open ? "is-open" : ""}`}
          aria-label="主导航"
          onPointerLeave={() =>
            placeIndicator(
              nav.current,
              nav.current?.querySelector<HTMLElement>(".is-active") || null,
            )
          }
          onFocusCapture={(event) =>
            placeIndicator(
              nav.current,
              (event.target as HTMLElement).closest<HTMLElement>(
                "[data-nav-section]",
              ),
            )
          }
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              placeIndicator(
                nav.current,
                nav.current?.querySelector<HTMLElement>(".is-active") || null,
              );
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              document
                .querySelector<HTMLButtonElement>(".menu-toggle")
                ?.focus();
            }
          }}
        >
          <span className="nav-tracker" aria-hidden="true" />
          {navSections.map((section, index) => (
            <Link
              key={section.id}
              data-nav-section={section.id}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse")
                  placeIndicator(nav.current, event.currentTarget);
              }}
              href={`/#${section.id}`}
              onClick={() => setOpen(false)}
              className={
                active === section.id ||
                (article && section.id === "articles") ||
                (travel && section.id === "travel")
                  ? "is-active"
                  : ""
              }
              aria-current={
                active === section.id ||
                (travel && section.id === "travel") ||
                (article && section.id === "articles")
                  ? "location"
                  : undefined
              }
            >
              <span className="nav-index">0{index + 1}</span>
              {section.label}
              <span className="nav-dot" />
            </Link>
          ))}
          <Link
            className="nav-contact"
            href="/#contact"
            onClick={() => setOpen(false)}
          >
            聊一聊 <Arrow diagonal />
          </Link>
        </nav>
      </div>
      <div
        className="reading-progress"
        data-reading-progress
        aria-hidden="true"
      />
    </header>
  );
}
