
"use client";

import MatchCard from "./MatchCard";
import styles from "./components.module.css";

export type Match = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string; // optional: could be URL to your product image
  similarity: number; // 0..1
};

export default function MatchGrid({ matches }: { matches: Match[] }) {
  return (
    <div className={styles.grid}>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}
