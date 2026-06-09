"use client";

import { useRef, useState, useCallback } from "react";
import { COLORS } from "./constants";
import { IconCamera, IconX } from "./Icons";

// Drag-and-drop image upload zone.
// `image`   — object URL string of the currently loaded image, or null
// `onImage` — called with a File when the user selects or drops one
// `onClear` — called when the user removes the current image
export default function UploadZone({ image, onImage, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) onImage(file);
  }, [onImage]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onImage(file);
  };

  return (
    <div
      onClick={() => !image && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      aria-label="Upload a clothing image"
      style={{
        width: "100%", maxWidth: 480,
        aspectRatio: "4/3",
        borderRadius: 16,
        background: image
          ? "transparent"
          : dragging ? "rgba(158,107,74,0.1)" : COLORS.bgUpload,
        border: `1.5px ${image ? "solid" : "dashed"} ${
          dragging ? COLORS.mocha : image ? COLORS.borderStrong : "rgba(158,107,74,0.3)"
        }`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: image ? "default" : "pointer",
        transition: "all 0.2s",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      {image ? (
        <>
          {/* Preview */}
          <img
            src={image}
            alt="Uploaded item"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", borderRadius: 14,
              position: "absolute", inset: 0,
            }}
          />
          {/* Clear button */}
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            aria-label="Remove image"
            style={{
              position: "absolute", top: 10, right: 10,
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(244,242,238,0.92)",
              border: `1px solid ${COLORS.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 5,
              transition: "background 0.15s",
            }}
          >
            <IconX color={COLORS.ink} />
          </button>
        </>
      ) : (
        /* Empty state prompt */
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 14,
          padding: 20, textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: COLORS.mochaLight,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconCamera color={COLORS.mocha} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: COLORS.ink, marginBottom: 6 }}>
              Drop your photo here
            </p>
            <p style={{ fontSize: 12, color: COLORS.muted, letterSpacing: "0.04em" }}>
              or click to browse — JPG, PNG, WEBP
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
