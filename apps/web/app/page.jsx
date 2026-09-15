import { COLORS } from "./components/constants";
import AppClient from "./components/AppClient";
import TrendingSection from "./components/TrendingSection";

export default function Trendyy() {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'DM Sans', sans-serif", color: COLORS.ink }}>
      <AppClient />
      <TrendingSection />
    </div>
  );
}
