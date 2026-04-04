"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const DarkMode: React.FC = () => {
  const { lang } = useParams();

  // Light/Dark Mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    // Retrieve the user's preference from local storage
    const storedPreference = localStorage.getItem("theme");
    if (storedPreference === "dark") {
      setIsDarkMode(true);
    }
  }, []);

  const handleToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    // Update the user's preference in local storage
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");

    // Update the class on the <html> element to apply the selected mode
    const htmlElement = document.querySelector("html");
    if (htmlElement) {
      if (isDarkMode) {
        htmlElement.classList.add("dark-theme");
      } else {
        htmlElement.classList.remove("dark-theme");
      }
    }
  }, [isDarkMode]);

  return (
    <>
      <span className="title">
        {lang === "en"
          ? "Light/Dark Mode"
          : lang === "fr"
          ? "Mode clair/sombre"
          : "الوضع الفاتح/الداكن"}
      </span>

      <button
        className={`switch-btn light-dark-btn bg-transparent border-none ${
          isDarkMode ? "active" : ""
        }`} // Add active class when dark mode is enabled
        onClick={handleToggle}
      >
        <div className="first">
          <div className="box">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="sub-title">
            <div className="dot-checkbox"></div>
            <span style={{ display: "block", fontWeight: "600" }}>
              {lang === "en" ? "Light" : lang === "fr" ? "Lumière" : "ضوء"}
            </span>
          </div>
        </div>

        <div className="second">
          <div className="box">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="sub-title">
            <div className="dot-checkbox"></div>
            <span style={{ display: "block", fontWeight: "600" }}>
              {lang === "en" ? "Dark" : lang === "fr" ? "Sombre" : "مظلم"}
            </span>
          </div>
        </div>
      </button>
    </>
  );
};

export default DarkMode;
