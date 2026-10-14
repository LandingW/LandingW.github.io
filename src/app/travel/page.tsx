import type { Metadata } from "next";
import Header from "@/components/Header";
import TravelGallery from "@/components/travel/TravelGallery";
import GrowingFractal from "@/components/GrowingFractal";

export const metadata: Metadata = {
  title: "旅行",
  description: "Land1ngW 的旅行照片、行程地点和拍摄设备。",
  alternates: { canonical: "/travel/" },
  openGraph: {
    title: "旅行 · landingw的主页",
    url: "https://landingw.github.io/travel/",
    description: "Land1ngW 的旅行照片、行程地点和拍摄设备。",
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
