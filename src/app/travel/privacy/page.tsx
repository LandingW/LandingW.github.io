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
            API。图钉只来自本人设置的旅行坐标、第一站位置或已公开的照片
            GPS，地点名称不会自动转换成位置；相近地点的多次旅行会合并为可展开预览的图钉。
          </p>
          <p>
            旅行详情的国家轮廓使用本地 Natural Earth 数据，根据已记录坐标匹配；
            小型离岸岛屿不在轮廓数据中时，可采用目的地名称里明确填写的国家。
            此名称仅用于选择轮廓，不会生成坐标。轮廓是展示示意，不用于边界判断或测量。
            手动编排的行程站点按保存顺序编号，以弧线连接；弧线仅表示站点关系，不是道路导航或真实行走轨迹。
            照片 GPS 单独展示，同一位置的照片合并显示，不按拍摄顺序推断行程。
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
            管理页在本人点击「查找地点」时，通过服务端向 Photon
            公共地名服务发送输入的关键词。
            不提供逐字自动补全，不读取设备当前位置，也不将照片 GPS
            自动发送给地名服务。
            搜索结果最多六项，缓存七天，并限制请求频率。Photon 使用
            OpenStreetMap
            数据，可能遗漏地点或暂时不可用；可改用地图点选、拖动图钉或手动填写坐标。
            未选定的搜索结果不会自动保存到旅行，只有已保存、已发布旅行的站点信息才会出现在公开清单。
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
