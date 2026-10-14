import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./motion.css";
import "./design.css";
import "./home.css";
import SiteMotion from "@/components/SiteMotion";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://landingw.github.io"),
  title: {
    default: "landingw的主页",
    template: "%s · landingw的主页",
  },
  description:
    "王若淼 / Land1ngW 的个人主页。目前在米哈游 Varsapura 做图形开发，主要涉及 UE5、Nanite Raster 和 PS5。这里有我的工作经历、技术文章和旅行照片。",
  keywords: [
    "游戏引擎",
    "图形程序",
    "Varsapura",
    "UE5",
    "Nanite Raster",
    "GPU Programming",
    "PS5",
    "AMD RDNA",
    "CUDA",
    "全局光照",
    "实时渲染",
    "Land1ngW",
  ],
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: {
    title: "landingw的主页",
    description: "王若淼 / Land1ngW，图形程序。工作经历、技术文章和旅行照片。",
    url: "https://landingw.github.io",
    siteName: "landingw的主页",
    locale: "zh_CN",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="editorial-site">
        <a className="skip-link" href="#main-content">
          跳至主要内容
        </a>
        {children}
        <SiteMotion />
      </body>
    </html>
  );
}
