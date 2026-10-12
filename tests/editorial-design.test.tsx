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
  for (const role of experiences)
    for (const detail of role.highlights) {
      const escaped = renderToStaticMarkup(
        createElement("p", null, detail.desc),
      ).slice(3, -4);
      assert.ok(html.includes(escaped), detail.title);
    }
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
