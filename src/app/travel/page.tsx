import type { Metadata } from "next";
import Header from "@/components/Header";
import TravelGallery from "@/components/travel/TravelGallery";

export const metadata: Metadata = {
  title: "旅行",
  description: "旅行照片与世界足迹。",
  alternates: { canonical: "/travel/" },
  openGraph: {
    title: "旅行 · landingw的主页",
    url: "https://landingw.github.io/travel/",
    description: "旅行照片与世界足迹。",
  },
};
export default function TravelPage() {
  return (
    <>
      <Header travel />
      <main id="main-content" className="page-container">
        <TravelGallery />
      </main>
    </>
  );
}
