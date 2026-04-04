// File Path: /styles/control-panel.scss

"use client";

import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import { Tooltip, Button } from "@mui/material";
import DarkMode from "./DarkMode";
import OnlySidebarDarkMode from "./OnlySidebarDarkMode";
import OnlyHeaderDarkMode from "./OnlyHeaderDarkMode";
import CompactSidebar from "./CompactSidebar";
import HorizontalLayout from "./HorizontalLayout";
import { useParams } from "next/navigation";

const ControlPanel: React.FC = () => {
  const { lang } = useParams();

  const [isControlPanel, setControlPanel] = useState<boolean>(false);

  const handleToggleControlPanel = () => {
    setControlPanel(!isControlPanel);
  };

  return (
    <>
      <Tooltip title="Settings" placement="left" arrow>
        <IconButton
          onClick={handleToggleControlPanel}
          size="small"
          sx={{
            width: "30px",
            height: "30px",
            p: 0,
          }}
          className="t-settings-btn"
        >
          <i className="material-symbols-outlined text-body">settings</i>
        </IconButton>
      </Tooltip>

      <div
        className={`settings-sidebar bg-white transition ${
          isControlPanel ? "active" : ""
        }`}
      >
        <div className="settings-header bg-primary">
          <h4 className="text-white">
            {lang === "en"
              ? "Theme Settings"
              : lang === "fr"
              ? "Paramètres du thème"
              : "إعدادات السمة"}
          </h4>
          <button
            className="close-btn text-white"
            type="button"
            onClick={handleToggleControlPanel}
          >
            <i className="material-symbols-outlined">close</i>
          </button>
        </div>

        <div className="settings-body">
          <DarkMode />

          <div className="border-bottom" style={{ margin: "15px 0" }}></div>

          <HorizontalLayout />

          <div className="border-bottom" style={{ margin: "15px 0" }}></div>

          <CompactSidebar />

          <div className="border-bottom" style={{ margin: "15px 0" }}></div>

          <OnlySidebarDarkMode />

          <div className="border-bottom" style={{ margin: "15px 0" }}></div>

          <OnlyHeaderDarkMode />

          <div className="border-bottom" style={{ margin: "15px 0" }}></div>

          <a href="https://1.envato.market/QyqV6P" target="_blank">
            <Button
              variant="contained"
              color="primary"
              sx={{
                textTransform: "capitalize",
                color: "#fff !important",
              }}
            >
              {lang === "en"
                ? "Buy Trezo"
                : lang === "fr"
                ? "Acheter Trezo"
                : "شراء تريزو"}
            </Button>
          </a>
        </div>
      </div>
    </>
  );
};

export default ControlPanel;
