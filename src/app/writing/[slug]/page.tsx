import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticles, getArticleOutline, siteUrl } from "@/lib/articles";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Arrow } from "@/components/Icons";

export const dynamicParams = false;
export function generateStaticParams() {
  return getArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticles().find((item) => item.slug === slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: article.sourceUrl || `${siteUrl}/writing/${slug}/`,
    },
    robots: article.hasFullContent ? undefined : { index: false, follow: true },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updated,
      url: `${siteUrl}/writing/${slug}/`,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticles().find((item) => item.slug === slug);
  if (!article) notFound();
  const outline = getArticleOutline(article.html);
  return (
    <>
      <Header article />
      <main id="main-content" className="page-container">
        <article className="reader">
          <Link href="/#articles" className="text-link reader-back">
            ← 全部文章
          </Link>
          <header className="reader-header">
            <p className="eyebrow">文章 / {article.category}</p>
            <h1>{article.title}</h1>
            <div className="article-meta">
              <span>王若淼 / Land1ngW</span>
              <time dateTime={article.date}>
                {article.date.replaceAll("-", ".")}
              </time>
              <span>
                {article.hasFullContent
                  ? `约 ${article.readingMinutes} 分钟`
                  : "文章摘要"}
              </span>
            </div>
          </header>
          {article.hasFullContent ? (
            <>
              <aside className="reader-source">
                <span>
                  {article.sourceUrl
                    ? "这篇文章也保存在本站，部分图片仍从原站加载。"
                    : "本文首发于本站。"}
                </span>
                {article.sourceUrl && (
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看原文 ↗
                  </a>
                )}
              </aside>
              {outline.length > 2 && (
                <details className="reader-toc">
                  <summary>
                    文章目录 <span>{outline.length} 个章节 +</span>
                  </summary>
                  <nav aria-label="文章目录">
                    <ol>
                      {outline.map((heading) => (
                        <li key={heading.id}>
                          <a href={`#${heading.id}`}>{heading.title}</a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </details>
              )}
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: article.html }}
              />
            </>
          ) : (
            <div className="reader-summary">
              <h2>摘要</h2>
              <p>{article.excerpt}</p>
              <p className="summary-notice">
                本站暂时只有摘要，全文请到知乎阅读。
              </p>
              <a
                className="button button-dark"
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                前往知乎阅读全文 <Arrow diagonal />
              </a>
            </div>
          )}
          <div className="reader-end">
            <p>感谢阅读。</p>
            <Link href="/#articles" className="text-link">
              其他文章 <Arrow />
            </Link>
          </div>
        </article>
        <Footer />
      </main>
    </>
  );
}
