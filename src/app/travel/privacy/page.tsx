import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "旅行影集与地图服务说明",
  alternates: { canonical: "/travel/privacy/" },
};

export default function TravelPrivacyPage() {
  return (
    <>
      <Header travel />
      <main id="main-content" className="page-container travel-policy">
        <p className="eyebrow">TRAVEL / 服务说明</p>
        <h1>照片与地图</h1>
        <section>
          <h2>照片和公开信息</h2>
          <p>
            影集由网站所有者管理。原片保存在私有 Cloudflare R2 中，GitHub
            Actions
            用于生成预览和高清切片。已发布旅行的照片、说明、摄影参数和允许公开的精确
            GPS 会展示给访客。
          </p>
          <p>
            生成的预览和切片位于公开展示存储；未发布的旅行不会列入公开影集，但知道完整图片链接的人仍可能访问展示文件。请勿将此服务作为机密文件库。
          </p>
        </section>
        <section>
          <h2>Google 地图</h2>
          <p>
            启用 Google 地图后，地点搜索、地图显示及相关网络请求由 Google Maps
            Platform 提供。使用地图功能须遵守{" "}
            <a
              href="https://maps.google.com/help/terms_maps/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps / Google Earth 附加服务条款
            </a>
            ；相关数据处理适用{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google 隐私政策
            </a>
            。
          </p>
          <p>
            网站长期保存所选地点的 Place ID，不把 Google
            返回的地名、地址和坐标另存为永久数据库。Google 地点内容在 Google
            地图内按需加载；手动添加的旅行标记与照片 GPS 属于独立的影集数据。
          </p>
          <p>
            Google 地图费用与额度由网站所有者的 Google Cloud
            项目管理。未配置或无法访问 Google
            时，照片浏览仍可使用；本地世界概览采用 Natural Earth
            数据，临时详情底图可使用保留署名的 OpenStreetMap。
          </p>
        </section>
        <section>
          <h2>管理页面</h2>
          <p>
            管理密码仅保留在当前页面内存。上传续传会在当前标签页保存照片编号、文件指纹及分片进度，不保存
            R2 或 GitHub 服务密钥。Google 浏览器 API key
            本来就会发送到访客浏览器，必须限制网站来源、API
            范围，并设置合适的配额。
          </p>
        </section>
        <p>
          <Link href="/travel/">← 返回旅行影集</Link> ·{" "}
          <Link href="/#contact">联系网站所有者</Link>
        </p>
      </main>
    </>
  );
}
