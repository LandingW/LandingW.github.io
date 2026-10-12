"use client";

import { useEffect, useState } from "react";

const chapters = [
  { id: "story-places", label: "地点" },
  { id: "story-frames", label: "影像" },
  { id: "story-equipment", label: "拍摄档案" },
];

export default function TripChapterNav() {
  const [active, setActive] = useState(chapters[0].id);
  useEffect(() => {
    let frame = 0;
    function update() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        let current = chapters[0].id;
        for (const chapter of chapters) {
          if (
            (document.getElementById(chapter.id)?.getBoundingClientRect().top ??
              Infinity) <= 210
          )
            current = chapter.id;
        }
        setActive(current);
      });
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <nav className="journey-chapters" aria-label="旅行章节">
      <span className="mono journey-chapters-caption">INSIDE THIS JOURNEY</span>
      <div>
        {chapters.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            aria-current={active === chapter.id ? "location" : undefined}
          >
            <span className="mono">0{index + 1}</span>
            {chapter.label}
            <span className="chapter-arrow" aria-hidden="true">
              ↘
            </span>
          </a>
        ))}
      </div>
      <a
        className="journey-back-top"
        href="#story-top"
        aria-label="回到旅行开头"
      >
        ↑
      </a>
    </nav>
  );
}
