"use client";

import { COLORS } from "./constants";

const NAV_ITEMS = [
  { label: "Image Search", active: true },
  { label: "Saved Items" },
  { label: "Search History" },
];

// Slide-in navigation drawer with a dimming overlay.
// `open`    — whether the drawer is visible
// `onClose` — called when the overlay or close button is clicked
export default function Drawer({ open, onClose }) {
  return (
    <>
      {/* Dimming overlay — clicking closes the drawer */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: open ? "rgba(35,31,32,0.35)" : "transparent",
          zIndex: 90,
          pointerEvents: open ? "auto" : "none",
          transition: "background 0.3s",
        }}
      />

      {/* Drawer panel */}
      <nav
        aria-label="Main navigation"
        style={{
          position: "fixed", top: 0, left: 0,
          width: 260, height: "100%",
          background: "#EDEBE6",
          borderRight: `0.5px solid ${COLORS.border}`,
          zIndex: 100,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.32s cubic-bezier(.77,0,.175,1)",
          display: "flex", flexDirection: "column",
          paddingTop: 80, paddingBottom: 32,
        }}
      >
        <span style={{
          fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: COLORS.muted,
          padding: "0 28px 10px",
        }}>
          Menu
        </span>

        {NAV_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 28px",
              fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
              color: item.active ? COLORS.mocha : COLORS.muted,
              borderLeft: item.active ? `2px solid ${COLORS.mocha}` : "2px solid transparent",
              background: item.active ? COLORS.mochaLight : "transparent",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {item.label}
          </div>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{ padding: "0 28px" }}>
          <span style={{
            fontSize: 10, letterSpacing: "0.08em",
            textTransform: "uppercase", color: COLORS.muted,
          }}>
            Version 0.1 · Beta
          </span>
        </div>
      </nav>
    </>
  );
}
