import Navigation from "./components/Navigation";
import Hero from "./components/Hero";
import About from "./components/About";
import BatchTimings from "./components/BatchTimings";
import Services from "./components/Services";
import Testimonials from "./components/Testimonials";
import VideoGallery from "./components/VideoGallery";
import MemberSupport from "./components/MemberSupport";
import FinalCTA from "./components/FinalCTA";

export default function Home() {
  return (
    <main>
      <Navigation />
      <Hero />
      <About />
      <BatchTimings />
      <Services />
      <Testimonials />
      <VideoGallery />
      <MemberSupport />
      <FinalCTA />
    </main>
  );
}
