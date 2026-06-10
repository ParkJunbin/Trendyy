// ── Color tokens ──────────────────────────────────────────────
// PANTONE 11-4201 Cloud Dancer  → #F4F2EE (background)
// PANTONE 17-1230 Mocha Mousse  → #9E6B4A (primary action)
// Near-black for text            → #231F20
// Warm mid-tone for muted text   → #A09898

export const COLORS = {
  bg: "#F4F2EE",
  bgCard: "#ECEAE5",
  bgUpload: "rgba(158,107,74,0.06)",
  mocha: "#9E6B4A",
  mochaHover: "#8A5A3B",
  mochaLight: "rgba(158,107,74,0.12)",
  ink: "#231F20",
  muted: "#A09898",
  border: "rgba(35,31,32,0.12)",
  borderStrong: "rgba(158,107,74,0.4)",
};

// ── Trending placeholder data ──────────────────────────────────
// Replace with real API data from GET /trending once available
export const TRENDING = [
  { id: 1, label: "Linen co-ord",       searches: "2.4k", color: "#D4C5B0" },
  { id: 2, label: "Oversized blazer",   searches: "1.9k", color: "#C8BAA8" },
  { id: 3, label: "Maxi dress",         searches: "1.7k", color: "#BFB5A5" },
  { id: 4, label: "Wide-leg trousers",  searches: "1.5k", color: "#D9CFC2" },
  { id: 5, label: "Knit vest",          searches: "1.3k", color: "#C2B8AB" },
  { id: 6, label: "Leather tote",       searches: "1.1k", color: "#CAC0B3" },
];
