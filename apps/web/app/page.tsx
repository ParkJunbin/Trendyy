"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");

  const handleUpload = async () => {
    if (!file) {
      setResult("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult("Upload failed.");
    }
  };

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Fashion Trend AI</h1>
      <p>Upload an image to test the pipeline.</p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          setFile(selected);
        }}
      />

      <div style={{ marginTop: "20px" }}>
        <button onClick={handleUpload}>Upload</button>
      </div>

      <pre style={{ marginTop: "20px", background: "#f4f4f4", padding: "16px" }}>
        {result}
      </pre>
    </main>
  );
}