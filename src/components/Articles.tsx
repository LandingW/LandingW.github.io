"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ArticleSummary } from "@/lib/articles";
import SectionHeading from "./SectionHeading";
import { Arrow } from "./Icons";

const filters = ["全部", "渲染与光照", "引擎实践", "学习笔记", "随想"];
const PAGE_SIZE = 6;

function ArticleMeta({
  article,
  featured = false,
}: {
  article: ArticleSummary;
  featured?: boolean;
}) {
  return (
    <div className="article-meta">
      <time dateTime={article.date}>{article.date.replaceAll("-", ".")}</time>
      <span>{article.category}</span>
      <span>
        {article.hasFullContent
          ? `全文 · 约 ${article.readingMinutes} 分钟`
          : "摘要 · 知乎原文"}
      </span>
      {featured && (
        <span className="read-label">
          {article.hasFullContent ? "开始阅读" : "阅读摘要"}
          <Arrow />
        </span>
      )}
    </div>
  );
}

function LightStudy() {
  return (
    <div className="article-art">
      <Image
        src="/studies/cornell-box.webp"
        alt="Cornell Box 光照研究：红绿侧墙、面积光源与两个白色方块"
        width={480}
        height={480}
      />
      <div className="art-label mono">
        <span>CORNELL BOX</span>
        <span>LIGHT TRANSPORT / 02</span>
      </div>
    </div>
  );
}

export default function Articles({
  articles,
  syncedAt,
}: {
  articles: ArticleSummary[];
  syncedAt: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = articles.filter(
    (article) =>
      (category === "全部" || article.category === category) &&
      `${article.title} ${article.excerpt} ${article.category}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
  );
  // The server provides publication-time order, including time-of-day.
  const featured = articles[0];
  const reset = () => {
    setQuery("");
    setCategory("全部");
    setLimit(PAGE_SIZE);
  };

  return (
    <section id="articles" className="section">
      <SectionHeading number="03" english="FIELD NOTES" title="思考的切片">
        <div className="writing-links">
          <a className="text-link" href="/feed.xml">
            RSS 订阅 <Arrow diagonal />
          </a>
          <a
            className="text-link"
            href="https://www.zhihu.com/people/wrm-66-76"
            target="_blank"
            rel="noopener noreferrer"
          >
            知乎 <Arrow diagonal />
          </a>
        </div>
      </SectionHeading>
      {featured && !normalizedQuery && category === "全部" && (
        <Link href={`/writing/${featured.slug}/`} className="featured-article">
          <LightStudy />
          <div className="featured-copy">
            <span className="eyebrow">LATEST WRITING / 最新文章</span>
            <h3>{featured.title}</h3>
            <p>{featured.excerpt}</p>
            <ArticleMeta article={featured} featured />
          </div>
        </Link>
      )}
      <div className="writing-toolbar">
        <div className="article-filters" role="group" aria-label="文章分类">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={category === filter}
              onClick={() => {
                setCategory(filter);
                setLimit(PAGE_SIZE);
              }}
            >
              {filter}
            </button>
          ))}
        </div>
        <label className="article-search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            type="search"
            aria-label="搜索文章"
            placeholder="搜索标题、内容或关键词"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
        </label>
      </div>
      <p className="results-label" role="status" aria-live="polite">
        {filtered.length} 篇文字{query.trim() && ` · 搜索「${query.trim()}」`}
      </p>
      <div className="article-list" key={category}>
        {filtered.slice(0, limit).map((article, index) => (
          <Link
            className="article-row"
            key={article.slug}
            href={`/writing/${article.slug}/`}
          >
            <span className="mono">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{article.title}</h3>
              <ArticleMeta article={article} />
            </div>
            <Arrow diagonal />
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <h3>还没有找到这篇文字。</h3>
          <p>换一个关键词，或回到全部文章看看。</p>
          <button
            type="button"
            className="button button-outline"
            onClick={reset}
          >
            清除筛选 <Arrow />
          </button>
        </div>
      )}
      <div className="article-list-footer">
        <p>
          知乎索引更新于 {syncedAt.replaceAll("-", ".")} · 已存档{" "}
          {articles.filter((article) => article.hasFullContent).length}{" "}
          篇全文，其余保留摘要
        </p>
        {filtered.length > limit ? (
          <button
            className="button button-outline"
            type="button"
            onClick={() => setLimit(limit + PAGE_SIZE)}
          >
            继续阅读 · 还有 {filtered.length - limit} 篇{" "}
            <span aria-hidden="true">+</span>
          </button>
        ) : (
          filtered.length > PAGE_SIZE && (
            <button
              className="button button-outline"
              type="button"
              onClick={() => setLimit(PAGE_SIZE)}
            >
              收起列表 −
            </button>
          )
        )}
      </div>
    </section>
  );
}
