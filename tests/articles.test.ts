import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { profile, experiences, skills } from "../src/lib/resume";
import {
  getArticles,
  getArticleSummaries,
  sanitizeContent,
  plainText,
  parseMarkdownArticle,
  getArticleOutline,
} from "../src/lib/articles";

test("sanitizer removes active content, unsafe protocols and attributes", () => {
  const html = sanitizeContent(
    '<p onclick="alert(1)">保留正文</p><script>alert(1)</script><iframe src="https://example.com"></iframe><a href="javascript:alert(1)">link</a><img src="data:text/html,bad" onerror="alert(1)"><img src="//example.com/pixel"><svg onload="alert(1)"></svg>',
  );
  assert.match(html, /保留正文/);
  assert.doesNotMatch(
    html,
    /<script|<iframe|<svg|onclick|onerror|javascript:|data:text|<img/,
  );
  assert.match(html, /rel="noopener noreferrer"/);
});

test("Zhihu lazy images, equations, code and tables survive safe rendering", () => {
  const html = sanitizeContent(
    '<figure><img src="placeholder" data-original="https://pic.zhimg.com/real.jpg"><figcaption>图示</figcaption></figure><img src="https://www.zhihu.com/equation?tex=x" data-eeimg="1"><pre><code class="language-cpp">int x = 1;</code></pre><table><tr><td>1</td></tr></table>',
  );
  assert.match(html, /https:\/\/pic.zhimg.com\/real.jpg/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /data-eeimg="true"/);
  assert.match(html, /language-cpp/);
  assert.match(html, /<table>/);
});

test("plain text decodes entities, separates paragraphs and drops scripts", () => {
  assert.equal(
    plainText(
      "<p>A &amp; B</p><p>&lt;shader&gt; &#x4e2d;</p><script>secret()</script>",
    ),
    "A & B <shader> 中",
  );
});

test("all saved IDs have distinct routes and summaries ship no HTML", () => {
  const articles = getArticles();
  assert.ok(articles.length >= 20);
  assert.equal(
    new Set(articles.map((article) => article.slug)).size,
    articles.length,
  );
  assert.ok(
    articles.some((article) => article.slug === "zhihu-2027425907149652572"),
  );
  for (const article of getArticleSummaries())
    assert.equal("html" in article, false);
});

test("Markdown original renders a full article with an exact quoted Zhihu ID", () => {
  const article = parseMarkdownArticle(
    '---\ntitle: Rendering note\ndate: "2026-09-28"\ncategory: 学习笔记\nzhihu_id: "2027425907149652572"\n---\n## 标题\n\n正文 & 示例\n\n```cpp\nint x = 1;\n```',
    "rendering-note",
  );
  assert.equal(article.zhihuId, "2027425907149652572");
  assert.equal(article.hasFullContent, true);
  assert.match(article.html, /<h2 id="section-1">标题<\/h2>/);
  assert.match(article.html, /language-cpp/);
  assert.equal(article.readingMinutes, 1);
});

test("Markdown rejects unsafe IDs, missing metadata, invalid dates and reserved slugs", () => {
  assert.throws(() => parseMarkdownArticle("no metadata", "test"));
  assert.throws(() =>
    parseMarkdownArticle(
      '---\ntitle: X\ndate: "2026-02-30"\n---\nbody',
      "test",
    ),
  );
  assert.throws(() =>
    parseMarkdownArticle(
      '---\ntitle: X\ndate: "2026-09-28"\nzhihu_id: 2027425907149652572\n---\nbody',
      "test",
    ),
  );
  assert.throws(() =>
    parseMarkdownArticle(
      '---\ntitle: X\ndate: "2026-09-28"\n---\nbody',
      "zhihu-123",
    ),
  );
});

test("public full article has its final chapter and stable unique section anchors", () => {
  const article = getArticles().find(
    (item) => item.slug === "zhihu-2021899719325021160",
  )!;
  assert.equal(article.hasFullContent, true);
  assert.match(article.html, /大规模指挥计算力的时代才刚刚开始/);
  const outline = getArticleOutline(article.html);
  assert.equal(outline.length, 15);
  assert.equal(new Set(outline.map((heading) => heading.id)).size, 15);
  assert.equal(outline.at(-1)?.title, "写在最后");
});

test("article order retains time-of-day within the same date", () => {
  const articles = getArticles();
  const secondLesson = articles.findIndex(
    (item) => item.slug === "zhihu-29575694050",
  );
  const firstLesson = articles.findIndex(
    (item) => item.slug === "zhihu-29574999426",
  );
  assert.ok(secondLesson < firstLesson);
});

test("image dimensions survive sanitation to reserve layout before lazy loading", () => {
  const image = sanitizeContent(
    '<img src="https://example.com/a.png" data-rawwidth="552" data-rawheight="1996">',
  );
  assert.match(image, /width="552"/);
  assert.match(image, /height="1996"/);
  assert.doesNotMatch(
    sanitizeContent(
      '<img src="https://example.com/a.png" width="bad" height="1996">',
    ),
    /width=|height=/,
  );
});

test("new public article is first, complete, and dated in the author's timezone", () => {
  const articles = getArticles();
  const article = articles[0];
  assert.equal(article.slug, "zhihu-2083215229815734954");
  assert.equal(article.title, "AI 写的史山让我重新学习软件工程");
  assert.equal(article.date, "2026-09-16");
  assert.equal(article.publishedAt, "2026-09-15T20:42:36.000Z");
  assert.equal(article.category, "随想");
  assert.equal(article.hasFullContent, true);
  assert.match(article.html, /能回答这些问题，才算真的开始做软件工程/);
  assert.equal(getArticleOutline(article.html).length, 18);
});

test("public profile names technologies without exposing internal project identifiers", () => {
  const publicText = JSON.stringify({
    profile,
    experiences,
    skills,
    articles: getArticles(),
  });
  const internalIdentifier = String.fromCharCode(84, 83, 68, 77);
  assert.equal(
    publicText.toLowerCase().includes(internalIdentifier.toLowerCase()),
    false,
  );
  for (const technology of ["Nanite Raster", "PS5", "RDNA", "CUDA", "PSSL"])
    assert.ok(publicText.includes(technology));
  assert.equal(JSON.stringify(experiences[0]).includes("CUDA"), false);
});

test("classic graphics decorations have local static image fallbacks", () => {
  for (const name of ["utah-teapot.webp", "cornell-box.webp"]) {
    const file = fs.readFileSync(`public/studies/${name}`);
    assert.equal(file.toString("ascii", 0, 4), "RIFF");
    assert.equal(file.toString("ascii", 8, 12), "WEBP");
    assert.ok(file.length > 1000);
  }
});
