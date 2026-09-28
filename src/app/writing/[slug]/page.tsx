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
            ← 返回所有文字
          </Link>
          <header className="reader-header">
            <p className="eyebrow">FIELD NOTES / {article.category}</p>
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
                    ? "本文为作者文章的站内存档；图片可能仍由原站提供。"
                    : "本文首发于本站。"}
                </span>
                {article.sourceUrl && (
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看原始发布 ↗
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
              <h2>先读一段</h2>
              <p>{article.excerpt}</p>
              <p className="summary-notice">
                本站目前仅保存了这篇文章的摘要，尚未导入全文。以下链接前往作者的知乎原文；本站不会把摘要当作完整文章。
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
            <p>文字是思考留下的痕迹。感谢你的阅读。</p>
            <Link href="/#articles" className="text-link">
              继续探索其他文章 <Arrow />
            </Link>
          </div>
        </article>
        <Footer />
      </main>
    </>
  );
}
