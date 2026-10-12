import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Experience from "@/components/Experience";
import Skills from "@/components/Skills";
import Articles from "@/components/Articles";
import Footer from "@/components/Footer";
import { getArticleSummaries, getSyncDate } from "@/lib/articles";
import HomepageWarmup from "@/components/HomepageWarmup";
import TravelPreview from "@/components/travel/TravelPreview";
import GrowingFractal from "@/components/GrowingFractal";

export default function Home() {
  return (
    <HomepageWarmup>
      <GrowingFractal />
      <Header />
      <main id="main-content" className="page-container">
        <Hero />
        <Experience />
        <Skills />
        <Articles articles={getArticleSummaries()} syncedAt={getSyncDate()} />
        <TravelPreview />
        <Footer />
      </main>
    </HomepageWarmup>
  );
}
