import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-container not-found">
        <p className="eyebrow">404 / OUTSIDE THE FRAME</p>
        <h1>这一页，尚未被渲染。</h1>
        <p>链接可能已变更，回到主页继续探索吧。</p>
        <Link className="button button-dark" href="/">
          返回主页 ↗
        </Link>
      </main>
    </>
  );
}
