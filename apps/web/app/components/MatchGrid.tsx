
"use client";

import MatchCard from "./MatchCard";
import styles from "./components.module.css";

type TagScore = {
  tag: string;
  score: number;
};

export type Match = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string; // optional: could be URL to your product image
  similarity: number; // 0..1
};

type Props = {
  matches: Match[];
  categoryTags?: TagScore[];
};

function findMatchingTag(category: string, categoryTags: TagScore[]) {
  const normalizedCategory = category.toLowerCase();
  return (
    categoryTags.find(({ tag }) => {
      const normalizedTag = tag.toLowerCase();
      return (
        normalizedCategory.includes(normalizedTag) ||
        normalizedTag.includes(normalizedCategory)
      );
    })?.tag ?? null
  );
}

export default function MatchGrid({ matches, categoryTags = [] }: Props) {
  const sortedMatches = [...matches].sort((a, b) => {
    const aMatch = findMatchingTag(a.category, categoryTags);
    const bMatch = findMatchingTag(b.category, categoryTags);

    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return b.similarity - a.similarity;
  });

  return (
    <div className={styles.grid}>
      {sortedMatches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          matchedCategoryTag={findMatchingTag(m.category, categoryTags)}
        />
      ))}
    </div>
  );
}
