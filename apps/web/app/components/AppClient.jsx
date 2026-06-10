"use client";

import { useState } from "react";
import { COLORS } from "./constants";
import { IconMenu, IconSearch } from "./Icons";
import Drawer from "./Drawer";
import UploadZone from "./UploadZone";

export default function AppClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageURL, setImageURL] = useState(null);

  const handleImage = (file) => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(URL.createObjectURL(file));
  };

  const handleClear = () => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(null);
  };

  const handleSearch = () => {
    // TODO: POST imageURL to /upload and display results
    alert("Search will send your image to the /upload API.");
  };

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

      {/* ── Hero / Upload ── */}
      <main className="hero-main">
        <h1 className="hero-title">Look for Anything</h1>

        <UploadZone image={imageURL} onImage={handleImage} onClear={handleClear} />

        <button
          disabled={!imageURL}
          onClick={handleSearch}
          className={imageURL ? "search-btn active" : "search-btn"}
        >
          <IconSearch size={17} color="currentColor" />
          Search Similar Items
        </button>
      </main>
    </>
  );
}
