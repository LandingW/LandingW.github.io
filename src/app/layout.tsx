import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Land1ngW's Base",
  description:
    "Land1ngW — 游戏引擎开发 / 图形渲染工程师，现于米哈游 Varsapura 工作，具备 1 年+ 自研 GI 系统研发经验，专注 UE5 全局光照、渲染管线、SparseRT 与光线追踪。",
  keywords: ["游戏引擎", "图形程序", "米哈游", "Varsapura", "UE5", "GI", "全局光照", "SparseRT", "渲染管线", "光线追踪", "Land1ngW"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
