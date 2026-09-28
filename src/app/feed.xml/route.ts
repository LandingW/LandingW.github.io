import { getArticles, siteUrl } from "@/lib/articles";

export const dynamic = "force-static";
function xml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
}

export function GET() {
  const articles = getArticles();
  const items = articles
    .map(
      (article) =>
        `<item><title>${xml(article.title)}</title><link>${siteUrl}/writing/${article.slug}/</link><guid isPermaLink="true">${siteUrl}/writing/${article.slug}/</guid><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate><category>${xml(article.category)}</category><description>${xml(article.excerpt)}</description></item>`,
    )
    .join("");
  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>landingw的主页</title><link>${siteUrl}</link><description>实时渲染、引擎研发与学习记录。</description><language>zh-cn</language><atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(feed, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
