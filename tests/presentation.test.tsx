import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Articles from "../src/components/Articles";
import ContactDetails from "../src/components/ContactDetails";
import HomepageWarmup from "../src/components/HomepageWarmup";
import { TeapotPoster } from "../src/components/TeapotStudy";
import { getArticleSummaries, getSyncDate } from "../src/lib/articles";
import { experiences, profile } from "../src/lib/resume";
import {
  approach,
  warmupFrame,
  WARMUP_DURATION_MS,
  headlineTiming,
} from "../src/lib/motion";

test("the pinned card automatically links to the newest published article", () => {
  const articles = getArticleSummaries();
  const html = renderToStaticMarkup(
    createElement(Articles, { articles, syncedAt: getSyncDate() }),
  );
  const card = html.match(
    /<a\b(?=[^>]*class="featured-article")[^>]*>[\s\S]*?<\/a>/,
  )?.[0];
  assert.ok(card);
  const href = card.match(/href="([^"]+)"/)?.[1];
  assert.equal(href?.replace(/\/$/, ""), `/writing/${articles[0].slug}`);
  assert.match(card, /LATEST WRITING/);
  assert.ok(articles.every((article) => !("featured" in article)));
});

test("work history has local company logos, detailed responsibilities and the updated role", () => {
  for (const experience of experiences) {
    assert.ok(fs.existsSync(`public${experience.logo.src}`));
    assert.ok(experience.highlights.length >= 2);
    assert.ok(experience.highlights.every((entry) => entry.desc.length > 50));
    assert.ok(!experience.role.includes("实习生"));
  }
  assert.equal(experiences[1].role, "游戏引擎图形开发");
});

test("QQ and WeChat are rendered as distinct copyable contact handles", () => {
  assert.equal(profile.qq, "1738832489");
  assert.equal(profile.wechat, "17304471585");
  const html = renderToStaticMarkup(
    createElement(ContactDetails, { qq: profile.qq, wechat: profile.wechat }),
  );
  assert.ok(html.includes(profile.qq) && html.includes(profile.wechat));
  assert.match(html, /复制QQ号码/);
  assert.match(html, /复制微信号码/);
});

test("teapot fallback exists only before WebGL is ready or in static mode", () => {
  assert.equal(
    renderToStaticMarkup(createElement(TeapotPoster, { visible: false })),
    "",
  );
  const poster = renderToStaticMarkup(
    createElement(TeapotPoster, { visible: true }),
  );
  assert.match(poster, /class="teapot-poster"/);
  assert.match(poster, /犹他茶壶/);
});

test("damping is independent of display refresh rate and never overshoots", () => {
  const simulate = (hz: number) => {
    let value = 0;
    for (let i = 0; i < hz; i++) value = approach(value, 1, 1000 / hz);
    return value;
  };
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 1e-10);
  assert.ok(Math.abs(simulate(60) - simulate(144)) < 1e-10);
  assert.ok(approach(0, 1, 1000) < 1);
  assert.equal(approach(0, 1, 16, 0), 1);
  assert.equal(approach(0, 1, -5), 0);
});

test("reconstruction progresses monotonically from noise to a complete image", () => {
  let previous = 0;
  for (let time = 0; time <= WARMUP_DURATION_MS; time += 20) {
    const state = warmupFrame(time);
    assert.ok(state.progress >= previous && state.progress <= 1);
    previous = state.progress;
  }
  assert.deepEqual(warmupFrame(0), { progress: 0, done: false });
  assert.deepEqual(warmupFrame(WARMUP_DURATION_MS), {
    progress: 1,
    done: true,
  });
  assert.equal("blur" in warmupFrame(500), false);
});

test("headline letters have distinct ignition timing and settle before the intro finishes", () => {
  const timings = Array.from({ length: 14 }, (_, i) => headlineTiming(i));
  assert.equal(
    new Set(timings.map((timing) => timing.delay)).size,
    timings.length,
  );
  assert.equal(new Set(timings.map((timing) => timing.pattern)).size, 3);
  assert.ok(
    timings.every(
      (timing) => timing.delay + timing.duration < WARMUP_DURATION_MS,
    ),
  );
});

test("glyph reconstruction preserves text and uses noise masks without Gaussian blur", () => {
  const html = renderToStaticMarkup(
    createElement(
      HomepageWarmup,
      null,
      createElement("h1", null, "Readable content"),
    ),
  );
  assert.match(html, /data-headline-warmup="starting"/);
  assert.match(html, /Readable content/);
  assert.equal(html.includes("data-text-warmup"), false);
  assert.match(html, /data-type-reveal="running"/);
  assert.match(html, /feTurbulence/);
  assert.match(html, /feDisplacementMap/);
  assert.match(html, /feComposite/);
  assert.equal(html.includes("feGaussianBlur"), false);
});
