import * as React from "react";
import Navbar from "@/components/FrontPages/Common/Navbar";
import ContactUs from "@/components/FrontPages/Common/ContactUs";
import Cta from "@/components/FrontPages/Common/Cta";
import Footer from "@/components/FrontPages/Common/Footer";
import PageBanner from "@/components/FrontPages/Common/PageBanner";
import { getDictionary } from "../../../[lang]/dictionaries";

export default async function Page({ params }: any) {
  const { lang } = await params; // Await params to get lang
  const dict = await getDictionary(lang);

  return (
    <>
      <div className="fp-wrapper">
        <Navbar {...dict} />

        <PageBanner pageTitle="Contact Us" />

        <ContactUs />

        <Cta />

        <Footer />
      </div>
    </>
  );
}
