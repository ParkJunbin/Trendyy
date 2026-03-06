"use client";

import { useState } from "react";

type Match = {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  imagePath: string;
  similarity: number;
};

type UploadResponse = {
  message: string;
  filename: string;
  topMatches: Match[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select an image first.");
      return;
    }

    setLoading(true);
    setMessage("");
    setMatches([]);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();

      setMessage(data.message);
      setMatches(data.topMatches ?? []);
    } catch (error) {
      setMessage("Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        padding: "40px",
        fontFamily: "Arial, sans-serif",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ marginBottom: "8px" }}>Fashion Trend AI</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Upload a fashion image to get similar item recommendations.
      </p>

      <div
        style={{
          marginTop: "24px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "12px",
          background: "#fafafa",
        }}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
          }}
        />

        <div style={{ marginTop: "16px" }}>
          <button
            onClick={handleUpload}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: "#111",
              color: "#fff",
            }}
          >
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {file && (
          <p style={{ marginTop: "12px", color: "#444" }}>
            Selected file: <strong>{file.name}</strong>
          </p>
        )}

        {message && (
          <p style={{ marginTop: "12px", color: "#222" }}>{message}</p>
        )}
      </div>

      <section style={{ marginTop: "36px" }}>
        <h2 style={{ marginBottom: "16px" }}>Recommended Items</h2>

        {matches.length === 0 ? (
          <p style={{ color: "#666" }}>
            No recommendations yet. Upload an image to see results.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "20px",
            }}
          >
            {matches.map((match) => (
              <div
                key={match.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    height: "160px",
                    borderRadius: "8px",
                    background: "#f2f2f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                    color: "#777",
                    fontSize: "14px",
                  }}
                >
                  Image placeholder
                </div>

                <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                  {match.title}
                </h3>

                <p style={{ margin: "4px 0", color: "#555" }}>
                  <strong>Brand:</strong> {match.brand}
                </p>

                <p style={{ margin: "4px 0", color: "#555" }}>
                  <strong>Category:</strong> {match.category}
                </p>

                <p style={{ margin: "4px 0", color: "#555" }}>
                  <strong>Price:</strong> ${match.price.toFixed(2)}
                </p>

                <p style={{ margin: "4px 0", color: "#555" }}>
                  <strong>Similarity:</strong>{" "}
                  {(match.similarity * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}