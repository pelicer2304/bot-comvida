"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useParams } from "next/navigation";

const Navbar: React.FC = ({
  forntpageNavigation,
}: {
  forntpageNavigation?: any;
}) => {
  const { lang } = useParams();

  const pathname = usePathname();

  const [isToggleNavbar, setToggleNavbar] = useState(true);
  const handleToggleNavbar = () => {
    setToggleNavbar(!isToggleNavbar);
  };

  // Sticky Menu
  const [isSticky, setIsSticky] = useState(false);

  // Sticky Menu Logic
  useEffect(() => {
    const handleScroll = () => {
      const shouldBeSticky = window.scrollY > 170;
      setIsSticky(shouldBeSticky);
    };

    // Check scroll position on mount
    handleScroll();

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <div
        id="navbar"
        className={`fp-navbar-area transition ${isSticky ? "sticky" : ""}`}
      >
        <div className="container">
          <nav className="navbar navbar-expand-lg">
            <Link className="navbar-brand" href={`/${lang}/`}>
              <Image
                src="/images/logo-big.svg"
                alt="logo"
                width={142}
                height={38}
              />
              <Image
                src="/images/white-logo-big.svg"
                className="d-none"
                alt="logo"
                width={142}
                height={38}
              />
            </Link>

            <button className="navbar-toggler">
              <span className="burger-menu" onClick={handleToggleNavbar}>
                <span className="top-bar"></span>
                <span className="middle-bar"></span>
                <span className="bottom-bar"></span>
              </span>
            </button>

            <div
              className={`collapse navbar-collapse ${
                isToggleNavbar ? "" : "show"
              }`}
            >
              <ul className="navbar-nav">
                {forntpageNavigation.links.map((link: any) => (
                  <li className="nav-item" key={link.name}>
                    <Link
                      href={`/${lang}${link.path}`}
                      className={`nav-link ${
                        pathname === `/${lang}${link.path}` ? "active" : ""
                      }`}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="other-options">
                <Link
                  href={`/${lang}/authentication/sign-in/`}
                  className="fp-outlined-btn"
                >
                  <i className="material-symbols-outlined">login</i>
                  {forntpageNavigation.login}
                </Link>
                <Link
                  href={`/${lang}/authentication/sign-up/`}
                  className="fp-btn"
                >
                  <i className="material-symbols-outlined">person</i>
                  {forntpageNavigation.register}
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
};

export default Navbar;
