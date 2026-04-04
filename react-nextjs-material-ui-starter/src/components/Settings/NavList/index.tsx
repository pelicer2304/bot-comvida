"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import styles from "@/components/Settings/NavList/NavList.module.css";

const NavList: React.FC = () => {
  const pathname = usePathname();
  const { lang } = useParams();

  return (
    <>
      <ul className={styles.navList}>
        <li>
          <Link
            href={`/${lang}/settings/`}
            className={`link ${
              pathname === `/${lang}/settings/` ? `${styles.active}` : ""
            }`}
          >
            Account Settings
          </Link>
        </li>
        <li>
          <Link
            href={`/${lang}/settings/change-password/`}
            className={`link ${
              pathname === `/${lang}/settings/change-password/`
                ? `${styles.active}`
                : ""
            }`}
          >
            Change Password
          </Link>
        </li>
        <li>
          <Link
            href={`/${lang}/settings/connections/`}
            className={`link ${
              pathname === `/${lang}/settings/connections/`
                ? `${styles.active}`
                : ""
            }`}
          >
            Connections
          </Link>
        </li>
        <li>
          <Link
            href={`/${lang}/settings/privacy-policy/`}
            className={`link ${
              pathname === `/${lang}/settings/privacy-policy/`
                ? `${styles.active}`
                : ""
            }`}
          >
            Privacy Policy
          </Link>
        </li>
        <li>
          <Link
            href={`/${lang}/settings/terms-conditions/`}
            className={`link ${
              pathname === `/${lang}/settings/terms-conditions/`
                ? `${styles.active}`
                : ""
            }`}
          >
            Terms & Conditions
          </Link>
        </li>
      </ul>
    </>
  );
};

export default NavList;
