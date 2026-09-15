"use client";

import { useState } from "react";
import { COLORS } from "./constants";
import { IconMenu } from "./Icons";
import Drawer from "./Drawer";
// import UploadZone from "./UploadZone";
import ImageSearch from "./ImageSearch";

export default function AppClient() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ── Topbar ── */}
      <header className="app-header">
        <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="menu-button">
          <IconMenu color={COLORS.ink} />
        </button>

        <span className="brand-title">Trendyy</span>

        <div className="beta-badge">Beta</div>
      </header>

      <ImageSearch />
    </>
  );
}
