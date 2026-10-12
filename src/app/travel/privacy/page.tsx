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
          <h2>开源地图与图钉</h2>
          <p>
            世界概览使用随网站加载的 Natural Earth 数据，不请求外部地图
            API。图钉只来自本人设置的旅行坐标或已公开的照片
            GPS，地点名称不会自动转换成位置；相近地点的多次旅行会合并为可展开预览的图钉。
          </p>
          <p>
            旅行详情的国家轮廓使用本地 Natural Earth 数据，根据已记录坐标匹配；
            小型离岸岛屿不在轮廓数据中时，可采用目的地名称里明确填写的国家。
            此名称仅用于选择轮廓，不会生成坐标。轮廓是展示示意，不用于边界判断或测量。
            旅行定位与照片 GPS
            分别展示，同一位置的照片合并显示；点位编号不代表行程顺序，
            不会将点位连线冒充实际走过的路线。
          </p>
          <p>
            详细地图与选点使用开源 Leaflet 和 OpenStreetMap 标准瓦片，不需要
            Google 账号、API key
            或地图付费配置。滚动接近详情地图或主动打开地图时，浏览器会向地图服务请求当前视野的瓦片；服务方会收到
            IP、网站来源等常规网络信息。
          </p>
          <p>
            OpenStreetMap
            的数据开放，但公共瓦片服务器是社区资助服务，不保证无限访问或可用性。本站保留地图署名、遵守浏览器缓存，不提供离线下载和批量预取。使用须遵守{" "}
            <a
              href="https://operations.osmfoundation.org/policies/tiles/"
              target="_blank"
              rel="noopener noreferrer"
            >
              瓦片使用政策
            </a>
            与{" "}
            <a
              href="https://osmfoundation.org/wiki/Privacy_Policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              隐私政策
            </a>
            。
          </p>
          <p>
            查找地名的链接会打开 OpenStreetMap
            网站；本站不调用自动补全或批量地名解析服务。没有坐标的旅行不会被猜测定位。
          </p>
        </section>
        <section>
          <h2>管理页面</h2>
          <p>
            管理密码仅保留在当前页面内存。上传续传会在当前标签页保存照片编号、文件指纹及分片进度，不保存
            R2 或 GitHub
            服务密钥。地图不需要输入密钥；修改旅行地点后保存即可更新足迹，无需重新构建网站。
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
