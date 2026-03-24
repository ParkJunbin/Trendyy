
"use client";

import styles from "./components.module.css";
import type { Match } from "./MatchGrid";

type Props = {
  match: Match;
  matchedCategoryTag?: string | null;
};

export default function MatchCard({ match, matchedCategoryTag }: Props) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        {match.imagePath ? (
          <img
            src={match.imagePath}
            alt={match.title}
            className={styles.image}
          />
        ) : (
          <div className={styles.placeholder}>Image placeholder</div>
        )}
      </div>

      <h3 className={styles.title}>{match.title}</h3>

      <p className={styles.meta}>
        <strong>Brand:</strong> {match.brand}
      </p>

      <p className={styles.meta}>
        <strong>Category:</strong> {match.category}
        {matchedCategoryTag ? (
          <span className={styles.tagMatch}> · tag: {matchedCategoryTag}</span>
        ) : null}
      </p>

      <p className={styles.meta}>
        <strong>Price:</strong> ${match.price.toFixed(2)}
      </p>

      <p className={styles.meta}>
        <strong>Similarity:</strong> {(match.similarity * 100).toFixed(1)}%
      </p>
    </article>
  );
}
