import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs/promises";
import {
  UI_MOTION,
  readingProgress,
  revealDelay,
  tripTransitionName,
} from "../src/lib/ui-motion";
import Header from "../src/components/Header";
import Experience from "../src/components/Experience";
import Skills from "../src/components/Skills";
import TripCover from "../src/components/travel/TripCover";
import TripStory from "../src/components/travel/TripStory";
import { albumInput, type TravelPhoto } from "../src/lib/travel";

test("motion progress and stagger remain finite and bounded", () => {
  assert.equal(readingProgress(0, 2000, 1000), 0);
  assert.equal(readingProgress(500, 2000, 1000), 0.5);
  assert.equal(readingProgress(3000, 2000, 1000), 1);
  assert.equal(readingProgress(-100, 2000, 1000), 0);
  assert.equal(readingProgress(50, 500, 500), 0);
  assert.equal(readingProgress(NaN, 1000, 500), 0);
  assert.equal(revealDelay(-3), 0);
  assert.equal(revealDelay(10000), UI_MOTION.maxStaggerMs);
});

test("SSR remains readable and the original four menu entries keep their destinations", () => {
  const experience = renderToStaticMarkup(createElement(Experience));
  const skills = renderToStaticMarkup(createElement(Skills));
  assert.match(experience, /data-reveal/);
  assert.match(skills, /data-reveal-index="2"/);
  assert.doesNotMatch(
    experience + skills,
    /reveal-state="pending"|opacity:0|visibility:hidden/,
  );
  const header = renderToStaticMarkup(createElement(Header));
  assert.match(header, /data-reading-progress/);
  assert.match(header, /nav-tracker/);
  for (const id of ["experience", "skills", "articles", "travel"])
    assert.match(header, new RegExp(`href="/#${id}"`));
});

test("travel list and story expose exactly one matching shared cover each", () => {
  const album = { id: "trip-test", ...albumInput({ title: "A trip" }) };
  const photos: TravelPhoto[] = ["a", "b"].map((id) => ({
    id,
    albumId: album.id,
    width: 1200,
    height: 800,
    caption: "",
    thumbnail: `photos/${id}/v1/thumbnail.jpg`,
    preview: `photos/${id}/v1/preview.jpg`,
    dzi: `photos/${id}/v1/image.dzi`,
  }));
  const list = renderToStaticMarkup(
    createElement(TripCover, {
      album,
      photos,
      mediaBase: "https://media.example.com",
      sharedTransition: true,
    }),
  );
  const story = renderToStaticMarkup(
    createElement(TripStory, {
      album,
      photos,
      config: { apiUrl: "", mediaUrl: "https://media.example.com" },
      onOpen: () => {},
      onBack: () => {},
    }),
  );
  assert.equal(
    (list.match(/view-transition-name:trip-cover-trip-test/g) || []).length,
    1,
  );
  assert.equal(
    (story.match(/view-transition-name:trip-cover-trip-test/g) || []).length,
    1,
  );
  assert.equal(tripTransitionName("../invalid"), "none");
});

test("motion code handles reduced preference, keyboard reveal, dynamic content and cleanup", async () => {
  const source = await fs.readFile("src/components/SiteMotion.tsx", "utf8");
  const css = await fs.readFile("src/app/motion.css", "utf8");
  assert.match(source, /prefers-reduced-motion/);
  assert.doesNotMatch(
    source,
    /pointermove|pointerOffset|--motion-x|--motion-y/,
  );
  assert.match(source, /visibilitychange/);
  assert.match(source, /focusin/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /changes.disconnect\(\)/);
  assert.match(source, /cancelAnimationFrame/);
  assert.doesNotMatch(source, /setInterval|preventDefault/);
  assert.match(css, /@media print/);
  assert.match(css, /prefers-reduced-motion/);
});
