import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs/promises";
import Hero from "../src/components/Hero";
import Experience from "../src/components/Experience";
import Skills from "../src/components/Skills";
import Footer from "../src/components/Footer";
import Header from "../src/components/Header";
import TravelPreview from "../src/components/travel/TravelPreview";
import TravelPrivacyPage from "../src/app/travel/privacy/page";

test("portfolio introduces its owner and actual work without the old slogans", () => {
  const html = [Hero, Experience, Skills, Footer, TravelPreview]
    .map((Component) => renderToStaticMarkup(createElement(Component)))
    .join("");
  assert.match(html, /aria-label="王若淼 \/ Land1ngW"/);
  assert.match(html, /在米哈游做图形开发/);
  assert.match(html, /项目细节不便展开/);
  assert.match(html, /技术笔记/);
  assert.doesNotMatch(
    html,
    /THINK IN PIXELS|于细微处|构建真实|从理解光|思考的切片|留在光里|有趣的想法|ALWAYS LEARNING|FORM\. LIGHT\. CODE\./,
  );
});

test("plain navigation labels keep the four existing destinations", () => {
  const html = renderToStaticMarkup(createElement(Header));
  for (const [id, label] of [
    ["experience", "经历"],
    ["skills", "技术"],
    ["articles", "文章"],
    ["travel", "旅行"],
  ]) {
    assert.match(html, new RegExp(`href="/#${id}"[^>]*>[\\s\\S]*?${label}`));
  }
  assert.match(html, /联系我/);
});

test("gallery and editor copy names actions instead of inventing travel stories", async () => {
  const files = [
    "TravelGallery",
    "TripStory",
    "TripAtlas",
    "TripEquipment",
    "PhotoLibrary",
    "TravelManager",
    "RouteEditor",
  ];
  const source = (
    await Promise.all(
      files.map((file) =>
        fs.readFile(`src/components/travel/${file}.tsx`, "utf8"),
      ),
    )
  ).join("\n");
  assert.doesNotMatch(
    source,
    /把片刻|留在光里|风景的坐标|光线背后|把停留|下一站，去哪里|给这段旅程|最后看一眼|READY WHEN YOU ARE|COLLECTED MOMENTS/,
  );
  assert.match(source, /发布前检查/);
  assert.match(source, /上传和处理不会自动发布/);
  assert.match(source, /永久删除/);
  assert.match(source, /无法恢复/);
  assert.match(source, /photo\.caption \|\|/);
  assert.match(source, /\{album\.description\}/);
});

test("shorter service copy still discloses public derivatives, precise GPS and external map requests", () => {
  const html = renderToStaticMarkup(createElement(TravelPrivacyPage));
  for (const text of [
    "私有",
    "精确 GPS",
    "已有图片链接仍可能有效",
    "第三方缓存",
    "不用于边界判断或测量",
    "IP",
    "Photon",
    "关键词",
    "内存",
    "断点续传",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /operations\.osmfoundation\.org\/policies\/tiles/);
  assert.match(html, /osmfoundation\.org\/wiki\/Privacy_Policy/);
});
