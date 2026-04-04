"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@mui/material";
import { usePathname, useParams } from "next/navigation";

// Type definition for a navigation item
interface NavItem {
  title: string;
  icon?: string;
  href?: string;
  badge?: string;
  badgeStyle?: string;
  isMegaMenu?: boolean;
  submenu?: NavItem[];
}

interface HorizontalNavbarProps {
  topHeaderNavbar: { horizontalNavbar: NavItem[] }; // Updated type for clarity
}

const HorizontalNavbar: React.FC<HorizontalNavbarProps> = ({
  topHeaderNavbar,
}) => {
  const pathname = usePathname();
  const { lang } = useParams();

  // Recursive function to render menu items
  const renderMenuItem = (item: NavItem, index: number): JSX.Element => {
    // Ensure href starts with "/" and prepend lang for comparison
    const itemHref = item.href
      ? `${item.href.startsWith("/") ? "" : "/"}${item.href}`
      : "";
    const isActive = item.href && pathname === `/${lang}${itemHref}`;
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    // Check if any submenu item is active
    const isSubmenuActive = item.submenu?.some(
      (subItem) =>
        subItem.href &&
        pathname ===
          `/${lang}${
            subItem.href.startsWith("/") ? subItem.href : `/${subItem.href}`
          }`
    );

    return (
      <li className="sidemenu-item" key={index}>
        {hasSubmenu ? (
          <>
            <Button
              type="button"
              className={`accordion-button ${
                item.icon ? "with-icon" : ""
              } border-radius ${isSubmenuActive ? "active" : ""}`}
            >
              {item.icon && (
                <i className="material-symbols-outlined">{item.icon}</i>
              )}
              <span className="title" style={{ lineHeight: 1 }}>
                {item.title}
              </span>
              {item.badge && (
                <span className={`trezo-badge ${item.badgeStyle || ""}`}>
                  {item.badge}
                </span>
              )}
            </Button>
            <div className="accordion-body border-radius">
              <ul className="sidebar-sub-menu">
                {(item.submenu ?? []).map((subItem, subIndex) =>
                  renderMenuItem(subItem, subIndex)
                )}
              </ul>
            </div>
          </>
        ) : (
          <Link
            href={item.href ? `/${lang}${itemHref}` : "#"}
            className={`sidemenu-link ${
              item.icon ? "with-icon" : ""
            } border-radius ${isActive ? "active" : ""}`}
          >
            {item.icon && (
              <i className="material-symbols-outlined">{item.icon}</i>
            )}
            <span className="title" style={{ lineHeight: 1 }}>
              {item.title}
            </span>
            {item.badge && (
              <span className={`trezo-badge ${item.badgeStyle || ""}`}>
                {item.badge}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="horizontal-navbar-area">
      <div className="accordion">
        {topHeaderNavbar.horizontalNavbar.map(
          (item: NavItem, index: number) => {
            // Check if any submenu item is active for the top-level accordion button
            const isSubmenuActive = item.submenu?.some(
              (subItem) =>
                subItem.href &&
                pathname ===
                  `/${lang}${
                    subItem.href.startsWith("/")
                      ? subItem.href
                      : `/${subItem.href}`
                  }`
            );

            return (
              <div
                className={`accordion-item border-radius border-0 ${
                  item.isMegaMenu ? "megamenu" : ""
                }`}
                key={index}
              >
                <Button
                  type="button"
                  className={`accordion-button ${
                    isSubmenuActive ? "active" : ""
                  }`}
                >
                  {item.icon && (
                    <i className="material-symbols-outlined">{item.icon}</i>
                  )}
                  <span className="title" style={{ lineHeight: 1 }}>
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className={`trezo-badge ${item.badgeStyle || ""}`}>
                      {item.badge}
                    </span>
                  )}
                </Button>

                <div className="accordion-body border-radius">
                  <ul className="sidebar-sub-menu">
                    {item.submenu?.map((subItem, subIndex) =>
                      renderMenuItem(subItem, subIndex)
                    )}
                  </ul>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

export default HorizontalNavbar;
