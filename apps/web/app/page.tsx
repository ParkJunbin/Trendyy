
// app/page.tsx
"use client";

import { useState } from "react";
import UploadForm from "./components/UploadForm";
import MatchGrid, { Match } from "./components/MatchGrid";
import styles from "./page.module.css";

export type UploadResponse = {
  message: string;
  filename: string;
  topMatches: Match[];
  tags?: TagsResponse;
};

export type TagScore = {
  tag: string;
  score: number;
};

export type TagsResponse = {
  category?: TagScore[];
  color?: TagScore[];
  material?: TagScore[];
};


export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [tags, setTags] = useState<TagsResponse | null>(null);

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    setTags(null);
    setMatches([]);
    setMessage("");
    // Create/remove preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select an image first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setMatches([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("threshold", "0.6");

    try {
      const uploadRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        throw new Error(`HTTP ${uploadRes.status}`);
      }

      const data: UploadResponse = await uploadRes.json();
      setMessage(data.message ?? "Upload complete.");
      setMatches(data.topMatches ?? []);
      setTags(data.tags ?? null);
    } catch (error) {
      setMessage("Upload failed: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Fashion Trend AI</h1>
        <p className={styles.subtitle}>
          Upload a fashion image to get similar item recommendations.
        </p>
      </header>

      <section className={styles.panel}>
        <UploadForm
          file={file}
          previewUrl={previewUrl}
          loading={loading}
          onFileChange={handleFileChange}
          onUpload={handleUpload}
          message={message}
        />
      </section>

      <section className={styles.results}>
        <h2 className={styles.resultsTitle}>Recommended Items</h2>
        {matches.length === 0 ? (
          <p className={styles.empty}>
            No recommendations yet. Upload an image to see results.
          </p>
        ) : (
          <MatchGrid matches={matches} categoryTags={tags?.category} />
        )}
      </section>
    </main>
  );
}
