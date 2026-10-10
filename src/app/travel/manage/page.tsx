import type { Metadata } from "next";
import Header from "@/components/Header";
import TravelManager from "@/components/travel/TravelManager";

export const metadata: Metadata = {
  title: "影集管理",
  robots: { index: false, follow: false },
  alternates: { canonical: "/travel/manage/" },
};
export default function ManagePhotosPage() {
  return (
    <>
      <Header travel />
      <main id="main-content" className="page-container">
        <TravelManager />
      </main>
    </>
  );
}
