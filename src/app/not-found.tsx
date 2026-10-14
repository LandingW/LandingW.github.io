import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-container not-found">
        <p className="eyebrow">404 / PAGE NOT FOUND</p>
        <h1>找不到这个页面</h1>
        <p>链接可能有误，或页面已经移走。</p>
        <Link className="button button-dark" href="/">
          返回主页 ↗
        </Link>
      </main>
    </>
  );
}
