
"use client";

import styles from "./components.module.css";

type Props = {
  file: File | null;
  previewUrl: string | null;
  loading: boolean;
  message: string;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
};

export default function UploadForm({
  file,
  previewUrl,
  loading,
  message,
  onFileChange,
  onUpload,
}: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className={styles.file}
        />
        <button
          onClick={onUpload}
          disabled={loading || !file}
          className={styles.button}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {file && (
        <p className={styles.selected}>
          Selected file: <strong>{file.name}</strong>
        </p>
      )}

      {previewUrl && (
        <div className={styles.previewWrapper}>
          <img src={previewUrl} alt="Preview" className={styles.preview} />
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
