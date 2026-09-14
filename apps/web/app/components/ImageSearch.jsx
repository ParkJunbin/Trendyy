"use client";

import { useEffect, useState } from "react";
import { COLORS } from "./constants";
import { IconSearch } from "./Icons";
import UploadZone from "./UploadZone";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ImageSearch() {
  const [file, setFile] = useState(null);
  const [imageURL, setImageURL] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    return () => {
      if (imageURL) URL.revokeObjectURL(imageURL);
    };
  }, [imageURL]);

  const handleImage = (nextFile) => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setFile(nextFile);
    setImageURL(URL.createObjectURL(nextFile));
    setMatches([]);
    setError("");
    setHasSearched(false);
  };

  const handleClear = () => {
    if (imageURL) URL.revokeObjectURL(imageURL);
    setFile(null);
    setImageURL(null);
    setMatches([]);
    setError("");
    setHasSearched(false);
  };

  const handleSearch = async () => {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Search failed");
      }

      setMatches(result.topMatches ?? []);
    } catch (searchError) {
      setMatches([]);
      setError(searchError.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="hero-main">
      <h1 className="hero-title">Look for Anything</h1>

      <UploadZone image={imageURL} onImage={handleImage} onClear={handleClear} />

      <button
        disabled={!file || loading}
        onClick={handleSearch}
        className={file && !loading ? "search-btn active" : "search-btn"}
      >
        <IconSearch size={17} color="currentColor" />
        {loading ? "Finding Similar Items..." : "Search Similar Items"}
      </button>

      {error && <p className="search-error" style={{ color: COLORS.mochaHover }} role="alert">{error}</p>}

      {matches.length > 0 && (
        <section className="search-results" aria-live="polite">
          <div className="results-heading" style={{ color: COLORS.ink }}>
            <h2 style={{ color: COLORS.ink }}>Similar Items</h2>
            <span style={{ color: COLORS.muted }}>{matches.length} found</span>
          </div>

          <div className="results-grid">
            {matches.map((product, index) => (
              <article
                className="result-card"
                key={product.id ?? `${product.imagePath}-${index}`}
                style={{ background: COLORS.bgCard, borderColor: COLORS.border }}
              >
                <img
                  src={product.imagePath}
                  alt={product.title || "Similar product"}
                  className="result-image"
                  style={{ background: COLORS.bgUpload }}
                />
                <div className="result-details">
                  <h3 style={{ color: COLORS.ink }}>{product.title || "Untitled product"}</h3>
                  {product.brand && <p className="result-brand" style={{ color: COLORS.muted }}>{product.brand}</p>}
                  {product.category && <p className="result-category" style={{ color: COLORS.muted }}>{product.category}</p>}
                  <div className="result-meta">
                    <span style={{ color: COLORS.ink }}>${Number(product.price ?? 0).toFixed(2)}</span>
                    <span style={{ color: COLORS.mocha }}>{(Number(product.similarity ?? 0) * 100).toFixed(0)}% match</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && hasSearched && matches.length === 0 && (
        <p className="search-empty" style={{ color: COLORS.muted }}>No similar items found.</p>
      )}
    </main>
  );
}
