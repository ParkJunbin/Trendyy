import { COLORS, TRENDING } from "./constants";
import { IconCamera, IconTrend } from "./Icons";

// Single trending item card.
// `item` — { id, label, searches, color }
function TrendingCard({ item }) {
  return (
    <div
      className="trending-card"
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: COLORS.bgCard,
        border: `0.5px solid ${COLORS.border}`,
        cursor: "pointer",
        transition: "transform 0.18s, box-shadow 0.18s",
        flexShrink: 0,
        width: 160,
      }}
    >
      {/* Image placeholder — swap for a real <img> once API data is available */}
      <div style={{
        height: 180,
        background: item.color,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconCamera size={28} color="rgba(35,31,32,0.25)" />
      </div>

      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: COLORS.ink, marginBottom: 3 }}>
          {item.label}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconTrend size={11} color={COLORS.mocha} />
          <span style={{ fontSize: 11, color: COLORS.mocha }}>{item.searches} searches</span>
        </div>
      </div>
    </div>
  );
}

// Horizontally scrollable row of trending items.
// Data comes from `TRENDING` in constants.js — replace with a real API call later.
export default function TrendingSection() {
  return (
    <section style={{ padding: "0 0 56px", borderTop: `0.5px solid ${COLORS.border}` }}>

      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        padding: "28px 36px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconTrend size={15} color={COLORS.mocha} />
          <span style={{
            fontSize: 11, fontWeight: 500,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: COLORS.mocha,
          }}>
            Trending now
          </span>
        </div>
        <span style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.04em" }}>
          Updated today
        </span>
      </div>

      {/* Scrollable card row */}
      <div style={{
        display: "flex", gap: 14,
        overflowX: "auto",
        padding: "0 36px 8px",
        scrollSnapType: "x mandatory",
      }}>
        {TRENDING.map((item) => (
          <div key={item.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
            <TrendingCard item={item} />
          </div>
        ))}
      </div>

    </section>
  );
}
