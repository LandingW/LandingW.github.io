import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://landingw.github.io"),
  title: {
    default: "landingw的主页",
    template: "%s · landingw的主页",
  },
  description:
    "王若淼 / Land1ngW，米哈游 Varsapura 图形程序。关注 Nanite Raster、GPU 编程、PS5 图形开发、AMD RDNA 与 CUDA / OptiX，记录引擎研发、学习与思考。",
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
    description: "图形程序 / 游戏引擎开发。工作、学习与思考的个人记录。",
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
      <body>
        <a className="skip-link" href="#main-content">
          跳至主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
