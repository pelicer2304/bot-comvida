import * as React from "react";
import Navbar from "@/components/FrontPages/Common/Navbar";
import HeroBanner from "@/components/FrontPages/Home/HeroBanner";
import KeyFeatures from "@/components/FrontPages/Common/KeyFeatures";
import Widgets from "@/components/FrontPages/Common/Widgets";
import Testimonials from "@/components/FrontPages/Common/Testimonials";
import OurTeam from "@/components/FrontPages/Common/OurTeam";
import FaqContent from "@/components/FrontPages/Common/FaqContent";
import ContactUs from "@/components/FrontPages/Common/ContactUs";
import Cta from "@/components/FrontPages/Common/Cta";
import Footer from "@/components/FrontPages/Common/Footer";
import { getDictionary } from "./dictionaries";

export default async function Home({ params }: any) {
  const { lang } = await params; // Await params to get lang
  const dict = await getDictionary(lang);

  return (
    <>
      <div className="fp-wrapper">
        <Navbar {...dict} />

        <HeroBanner {...dict} />

        <KeyFeatures />

        <Widgets />

        <Testimonials />

        <OurTeam />

        <FaqContent />

        <ContactUs />

        <Cta />

        <Footer />
      </div>
    </>
  );
}
