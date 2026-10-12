import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Hero from "../src/components/Hero";
import Experience from "../src/components/Experience";
import Skills from "../src/components/Skills";
import Articles from "../src/components/Articles";
import { getArticleSummaries, getSyncDate } from "../src/lib/articles";
import { experiences } from "../src/lib/resume";
import fs from "node:fs/promises";
import TravelPage from "../src/app/travel/page";

test("opening is a copy and study composition while retaining headline and graphics", () => {
  const html = renderToStaticMarkup(createElement(Hero));
  assert.match(html, /class="hero-copy"/);
  assert.match(html, /class="hero-exhibit"/);
  assert.ok(
    html.indexOf('class="hero-copy"') < html.indexOf('class="hero-exhibit"'),
  );
  assert.match(html, /aria-label="THINK IN PIXELS\."/);
  assert.match(html, /teapot-poster/);
  assert.doesNotMatch(html, /page-fractal|hero-fractal/);
  assert.match(html, /Varsapura/);
  assert.doesNotMatch(html, /class="hero-introduction"|class="hero-signature"/);
});

test("work disclosures preserve every technical description and only the current role starts expanded", () => {
  const html = renderToStaticMarkup(createElement(Experience));
  const disclosures = [...html.matchAll(/<details\b[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(disclosures.length, experiences.length);
  assert.equal(disclosures.filter((tag) => /\bopen=/.test(tag)).length, 1);
  assert.equal(
    (html.match(/class="experience-overview"/g) || []).length,
    experiences.length,
  );
  for (const role of experiences)
    for (const detail of role.highlights) {
      const escaped = renderToStaticMarkup(
        createElement("p", null, detail.desc),
      ).slice(3, -4);
      assert.ok(html.includes(escaped), detail.title);
    }
});

test("public portfolio canvases share width and paper tokens without widening article readers", async () => {
  const css = await fs.readFile("src/app/home.css", "utf8");
  const shared = await fs.readFile("src/app/globals.css", "utf8");
  assert.match(css, /\.home-page > \.page-container[\s\S]*?max-width: none/);
  assert.match(shared, /--page-width: 1180px/);
  assert.match(css, /--home-surface: #f7f5eff5/);
  assert.match(css, /\.home-page,\s*\.editorial-site \.travel-page\s*\{/);
  assert.match(
    css,
    /\.home-page \.experience-list[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    css,
    /\.home-page \.focus-grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/,
  );
  assert.match(css, /\.home-trip:only-child/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /safe-area-inset-left/);
  assert.doesNotMatch(css, /100vw|overflow-x: hidden/);
});

test("travel reuses the decorative scroll backdrop without applying homepage warmup to the gallery", () => {
  const html = renderToStaticMarkup(createElement(TravelPage));
  assert.match(html, /class="travel-page"/);
  assert.equal((html.match(/class="page-fractal"/g) || []).length, 1);
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /<footer class="travel-end"/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /data-headline-warmup|data-type-reveal/);
});

test("travel geography has an opaque surface and detail views retain responsive layouts", async () => {
  const css = await fs.readFile("src/app/travel/canvas.css", "utf8");
  const atlas = css.match(/\.travel-atlas-layout\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(atlas, /background: var\(--paper\)/);
  assert.match(css, /\.atlas-canvas\s*\{[^}]*max-width: none/);
  assert.match(
    css,
    /\.journey-cover-composition\[data-has-cover="false"\]\s*\{\s*grid-template-columns: 1fr/,
  );
  assert.match(
    css,
    /\.editorial-site:has\(\.photo-viewer\) \.travel-page > \.page-fractal\s*\{\s*display: none/,
  );
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /safe-area-inset-left/);
  assert.doesNotMatch(css, /100vw|overflow-x: hidden|\.travel-manager/);
});

test("focus and writing have separate chapter rails and content regions", () => {
  const skills = renderToStaticMarkup(createElement(Skills));
  const articles = renderToStaticMarkup(
    createElement(Articles, {
      articles: getArticleSummaries(),
      syncedAt: getSyncDate(),
    }),
  );
  assert.match(skills, /class="focus-content"/);
  assert.equal((skills.match(/class="focus-intro"/g) || []).length, 3);
  assert.match(articles, /class="writing-content"/);
  assert.match(articles, /class="featured-article"/);
  assert.match(articles, /aria-label="搜索文章"/);
});
