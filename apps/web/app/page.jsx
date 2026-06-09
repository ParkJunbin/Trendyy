"use client";

import { useState } from "react";
import { COLORS } from "./components/constants";
import { IconMenu, IconSearch } from "./components/Icons";
import Drawer from "./components/Drawer";
import UploadZone from "./components/UploadZone";
import TrendingSection from "./components/TrendingSection";

export default function Trendyy() {
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
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink }}>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ── Topbar ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 36px",
        position: "relative", zIndex: 10,
        borderBottom: `0.5px solid ${COLORS.border}`,
        background: COLORS.bg,
      }}>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 8, color: COLORS.ink, display: "flex",
          }}
        >
          <IconMenu color={COLORS.ink} />
        </button>

        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 24, letterSpacing: "0.14em",
          color: COLORS.ink,
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          userSelect: "none",
        }}>
          Trendyy
        </span>

        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: "0.12em",
          textTransform: "uppercase", color: COLORS.bg,
          background: COLORS.mocha, padding: "4px 12px", borderRadius: 20,
        }}>
          Beta
        </div>
      </header>

      {/* ── Hero / Upload ── */}
      <main style={{
        display: "flex", flexDirection: "column",
        alignItems: "center",
        padding: "52px 24px 48px",
        gap: 28,
      }}>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(40px, 7vw, 60px)",
          letterSpacing: "0.06em",
          color: COLORS.ink,
          textAlign: "center",
          lineHeight: 1,
        }}>
          Look for Anything
        </h1>

        <UploadZone image={imageURL} onImage={handleImage} onClear={handleClear} />

        <button
          disabled={!imageURL}
          onClick={handleSearch}
          style={{
            width: "100%", maxWidth: 480,
            padding: "15px 48px",
            background: imageURL ? COLORS.mocha : "rgba(158,107,74,0.25)",
            color: imageURL ? "#F4F2EE" : COLORS.muted,
            border: "none",
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 19, letterSpacing: "0.12em",
            borderRadius: 10,
            cursor: imageURL ? "pointer" : "not-allowed",
            transition: "background 0.2s, transform 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
          onMouseEnter={(e) => imageURL && (e.currentTarget.style.background = COLORS.mochaHover)}
          onMouseLeave={(e) => imageURL && (e.currentTarget.style.background = COLORS.mocha)}
          onMouseDown={(e) => imageURL && (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <IconSearch size={17} color="currentColor" />
          Search Similar Items
        </button>
      </main>

      {/* ── Trending ── */}
      <TrendingSection />

    </div>
  );
}
