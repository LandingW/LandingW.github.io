import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "照片与地图服务说明",
  alternates: { canonical: "/travel/privacy/" },
};

export default function TravelPrivacyPage() {
  return (
    <>
      <Header travel />
      <main id="main-content" className="page-container travel-policy">
        <p className="eyebrow">服务说明</p>
        <h1>照片与地图</h1>
        <section>
          <h2>照片和公开信息</h2>
          <p>
            这里的照片由我上传和管理。原片保存在私有的 Cloudflare R2
            存储中，GitHub Actions
            负责生成预览图和高清切片。发布后，访客可以看到照片、备注、拍摄参数，
            以及我选择公开的精确 GPS。
          </p>
          <p>
            预览图和切片可以通过链接访问。未发布或已撤下的旅行不会出现在列表里，
            但已有图片链接仍可能有效，第三方缓存也可能保留副本。因此这里不适合存放机密照片。
          </p>
        </section>
        <section>
          <h2>地图上的位置</h2>
          <p>
            世界地图使用本站的 Natural Earth 数据文件，不调用外部地图 API。
            图钉依次取旅行手动定位、行程第一站或已公开照片的
            GPS；只有地名、没有坐标时不会标点。
            位置相近的旅行会合并显示，点开后可以分别查看。
          </p>
          <p>
            国家轮廓也来自 Natural
            Earth，按坐标匹配。小岛未被数据覆盖时，会尝试使用目的地中明确填写的国家名称，
            但不会据此生成坐标。轮廓只作示意，不用于边界判断或测量。
          </p>
          <p>
            行程地点按保存顺序编号、连线，弧线不是实际道路或行走轨迹。 照片 GPS
            单独标记，同一位置的照片放在一起；旅行定位不会代替单张照片的拍摄位置。
          </p>
        </section>
        <section>
          <h2>地图加载与地点搜索</h2>
          <p>
            详细地图使用 Leaflet 和
            OpenStreetMap。滚动到地图附近或主动打开地图时， 浏览器会向
            OpenStreetMap 请求当前视野的地图图片，服务方会收到
            IP、网站来源等网络信息。
          </p>
          <p>
            OpenStreetMap 公共地图服务由社区资助，可能限流或暂时不可用。
            本站保留署名和浏览器缓存，不提供地图离线下载或批量预取。相关政策见{" "}
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
            管理页只有在点击「查找地点」后，才会通过服务器把关键词发给 Photon
            地名服务。 不读取设备当前位置，也不自动发送照片
            GPS。每次最多返回六个结果，缓存七天，并限制请求频率。 搜索使用
            OpenStreetMap
            数据，可能找不到某些地点；这时可以在地图上选点、拖动图钉或填写坐标。
            搜索结果不会自动保存或公开，只有加入旅行、保存并发布后才会显示。
          </p>
        </section>
        <section>
          <h2>密码与上传记录</h2>
          <p>
            管理密码只保留在当前页面内存，刷新后需要重新输入。
            为了支持断点续传，当前标签页会保存照片编号、文件指纹和上传进度，
            不保存 R2 或 GitHub 密钥。上传未完成时关闭页面可能中断上传；
            原片上传完成后，后台处理不需要页面保持打开。
          </p>
        </section>
        <p>
          <Link href="/travel/">← 全部旅行</Link> ·{" "}
          <Link href="/#contact">联系我</Link>
        </p>
      </main>
    </>
  );
}
