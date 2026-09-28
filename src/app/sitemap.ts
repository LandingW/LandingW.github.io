import type { MetadataRoute } from "next";
import { getArticles, siteUrl } from "@/lib/articles";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, priority: 1 },
    ...getArticles()
      .filter((article) => article.hasFullContent)
      .map((article) => ({
        url: `${siteUrl}/writing/${article.slug}/`,
        lastModified: article.updated,
        priority: 0.7,
      })),
  ];
}
