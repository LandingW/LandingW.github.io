"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { navSections } from "@/lib/resume";
import { Arrow } from "./Icons";
import FractalMark from "./FractalMark";

export default function Header({ article = false }: { article?: boolean }) {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (article) return;
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
  }, [article]);

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
          onClick={() => setOpen(!open)}
        >
          {open ? "关闭 −" : "菜单 +"}
        </button>
        <nav
          id="main-nav"
          className={`main-nav ${open ? "is-open" : ""}`}
          aria-label="主导航"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              document
                .querySelector<HTMLButtonElement>(".menu-toggle")
                ?.focus();
            }
          }}
        >
          {navSections.map((section, index) => (
            <Link
              key={section.id}
              href={`/#${section.id}`}
              onClick={() => setOpen(false)}
              className={
                active === section.id || (article && section.id === "articles")
                  ? "is-active"
                  : ""
              }
              aria-current={active === section.id ? "location" : undefined}
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
    </header>
  );
}
