import type { Metadata } from "next";
import Header from "@/components/Header";
import TravelGallery from "@/components/travel/TravelGallery";
import GrowingFractal from "@/components/GrowingFractal";

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
    <div className="travel-page">
      <GrowingFractal />
      <Header travel />
      <main id="main-content" className="page-container">
        <TravelGallery />
      </main>
    </div>
  );
}
