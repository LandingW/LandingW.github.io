import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import he from "he";
import articleData from "../../data/articles.json";

export const siteUrl = "https://landingw.github.io";
export const categories = [
  "全部",
  "渲染与光照",
  "引擎实践",
  "学习笔记",
  "随想",
] as const;
export type Category = Exclude<(typeof categories)[number], "全部">;

export interface ArticleSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: Category;
  date: string;
  source: "知乎" | "本站";
  sourceUrl?: string;
  hasFullContent: boolean;
  readingMinutes: number | null;
}

export interface Article extends ArticleSummary {
  html: string;
  updated: string;
  publishedAt: string;
}

export function plainText(html: string): string {
  const text = sanitizeHtml(
    html.replace(/<\/(p|div|h[1-6]|li|pre)>/gi, "</$1> "),
    { allowedTags: [], allowedAttributes: {} },
  );
  return he.decode(text).replace(/\s+/g, " ").trim();
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeContent(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "del",
      "sup",
      "sub",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: [
        "src",
        "alt",
        "title",
        "loading",
        "decoding",
        "referrerpolicy",
        "data-eeimg",
        "width",
        "height",
      ],
      code: ["class"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      img: (_tag, attributes) => {
        const dimension = (value: string | undefined) =>
          value &&
          /^\d{1,5}$/.test(value) &&
          Number(value) > 0 &&
          Number(value) <= 20000
            ? value
            : undefined;
        const width = dimension(
          attributes.width || attributes["data-rawwidth"],
        );
        const height = dimension(
          attributes.height || attributes["data-rawheight"],
        );
        const src =
          attributes["data-original"] ||
          attributes["data-actualsrc"] ||
          attributes.src ||
          "";
        const isLocal = /^\/(?!\/)/.test(src);
        const isEquation = Boolean(
          attributes["data-eeimg"] || src.includes("/equation?"),
        );
        return {
          tagName: "img",
          attribs: {
            src: safeUrl(src) || (isLocal ? src : ""),
            alt: attributes.alt || "",
            loading: "lazy",
            decoding: "async",
            referrerpolicy: "no-referrer",
            ...(width && height ? { width, height } : {}),
            ...(isEquation ? { "data-eeimg": "true" } : {}),
          },
        };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
  let headingIndex = 0;
  return sanitized.replace(
    /<(h[2-4])>([\s\S]*?)<\/\1>/g,
    (_match, tag, text) =>
      `<${tag} id="section-${++headingIndex}">${text}</${tag}>`,
  );
}

export function getArticleOutline(html: string) {
  const headings = Array.from(
    html.matchAll(/<(h[2-4]) id="(section-\d+)">([\s\S]*?)<\/\1>/g),
    (match) => ({
      level: Number(match[1][1]),
      id: match[2],
      title: plainText(match[3]),
    }),
  );
  const chapters = headings.filter((heading) =>
    /^第\d+章|^写在最后/.test(heading.title),
  );
  if (chapters.length > 2) return chapters;
  const highest = Math.min(...headings.map((heading) => heading.level));
  return headings.filter((heading) => heading.level === highest);
}

export function categorize(title: string): Category {
  if (/经验.*思考|随想|杂谈|软件工程/.test(title)) return "随想";
  if (/学习笔记|lightmass源码/i.test(title)) return "学习笔记";
  if (/Lumen|蓝屏|调试|二次开发|遮挡/i.test(title)) return "引擎实践";
  return "渲染与光照";
}

function timestampDate(value: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value * 1000));
}

export function parseMarkdownArticle(
  raw: string,
  slug: string,
): Article & { zhihuId?: string } {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.startsWith("zhihu-"))
    throw new Error(`Invalid or reserved article filename: ${slug}`);
  const { data, content } = matter(raw);
  const date =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date || "");
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error(
      `Article ${slug} requires a title and a valid YYYY-MM-DD date.`,
    );
  if (
    data.zhihu_id !== undefined &&
    (typeof data.zhihu_id !== "string" || !/^\d+$/.test(data.zhihu_id))
  )
    throw new Error(
      `Quote zhihu_id in ${slug} to preserve its exact integer value.`,
    );
  const html = sanitizeContent(
    marked.parse(content, { async: false }) as string,
  );
  const text = plainText(html);
  if (!text) throw new Error(`Article ${slug} has no text content.`);
  const sourceUrl = safeUrl(data.source_url);
  if (data.source_url && !sourceUrl)
    throw new Error(`Invalid source_url in ${slug}.`);
  if (data.category && !categories.slice(1).includes(data.category))
    throw new Error(`Invalid category in ${slug}.`);
  return {
    slug,
    title: data.title.trim(),
    date,
    updated: date,
    publishedAt: new Date(date).toISOString(),
    excerpt:
      typeof data.description === "string"
        ? data.description
        : text.slice(0, 180),
    category: data.category || categorize(data.title),
    source: data.zhihu_id ? "知乎" : "本站",
    sourceUrl,
    hasFullContent: true,
    html,
    readingMinutes: Math.max(1, Math.ceil(text.length / 450)),
    zhihuId: data.zhihu_id,
  };
}

export function getArticles(): Article[] {
  const articles: Article[] = articleData.articles.map((entry) => {
    const raw = entry as typeof entry & { content_html?: string };
    const html = sanitizeContent(raw.content_html || "");
    const text = plainText(html);
    return {
      slug: `zhihu-${entry.id}`,
      title: entry.title,
      excerpt: plainText(entry.excerpt),
      category: categorize(entry.title),
      date: timestampDate(entry.created),
      updated: timestampDate(entry.updated || entry.created),
      publishedAt: new Date(entry.created * 1000).toISOString(),
      source: "知乎",
      sourceUrl: `https://zhuanlan.zhihu.com/p/${entry.id}`,
      html,
      hasFullContent: Boolean(text),
      readingMinutes: text ? Math.max(1, Math.ceil(text.length / 450)) : null,
    };
  });
  const directory = path.join(process.cwd(), "content", "writing");
  if (fs.existsSync(directory)) {
    for (const filename of fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".md"))
      .sort()) {
      const raw = fs.readFileSync(path.join(directory, filename), "utf8");
      if (matter(raw).data.draft === true) continue;
      const article = parseMarkdownArticle(raw, filename.slice(0, -3));
      const duplicate = article.zhihuId
        ? articles.findIndex((item) => item.slug === `zhihu-${article.zhihuId}`)
        : -1;
      // Keep old URLs stable when an exported Markdown original replaces a Zhihu excerpt.
      if (duplicate >= 0)
        articles[duplicate] = {
          ...article,
          slug: articles[duplicate].slug,
          sourceUrl: article.sourceUrl || articles[duplicate].sourceUrl,
        };
      else articles.push(article);
    }
  }
  return articles.sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      a.slug.localeCompare(b.slug),
  );
}

export function getArticleSummaries(): ArticleSummary[] {
  return getArticles().map((article) => ({
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    date: article.date,
    source: article.source,
    sourceUrl: article.sourceUrl,
    hasFullContent: article.hasFullContent,
    readingMinutes: article.readingMinutes,
  }));
}

export function getSyncDate(): string {
  return articleData.updated_at.slice(0, 10);
}
