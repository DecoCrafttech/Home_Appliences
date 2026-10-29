import { ImageWithFallback } from "@home/ui";
import { useState, type ChangeEvent } from "react";
import axios from "axios";
import { api } from "./api";

export function CatalogueIconUpload({
  preview,
  onChange,
  onBusyChange,
}: {
  preview: string;
  onChange: (key: string | null, preview: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [progress, setProgress] = useState<number>();
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setUploaded(false);
    const extension = file.name.split(".").pop()?.toLowerCase();
    const contentType = extension === "svg" ? "image/svg+xml" : file.type;
    if (!file.size || file.size > 262144) {
      setError("Choose a non-empty icon up to 256 KB.");
      return;
    }
    if (
      !["image/svg+xml", "image/png", "image/jpeg", "image/webp"].includes(
        contentType,
      )
    ) {
      setError("Choose an SVG, PNG, JPEG or WebP image.");
      return;
    }
    setUploading(true);
    setProgress(undefined);
    onBusyChange(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]!);
        reader.onerror = () => reject(new Error("Unable to read this file."));
        reader.readAsDataURL(file);
      });
      const result = await api.post<{
        data: { object_key: string; previewUrl: string };
      }>(
        "/catalogue/media",
        { contentType, data },
        {
          onUploadProgress: (event) => {
            if (event.total)
              setProgress(Math.round((event.loaded / event.total) * 100));
          },
        },
      );
      onChange(result.data.data.object_key, result.data.data.previewUrl);
      setUploaded(true);
    } catch (cause) {
      setError(
        axios.isAxiosError(cause)
          ? cause.response?.data?.error?.message ||
              "Unable to upload. Check your connection and try again."
          : "Unable to read this file. Please select it again.",
      );
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="catalogue-icon-upload" aria-busy={uploading}>
      {preview && (
        <ImageWithFallback
          src={preview}
          className="catalogue-icon-preview"
          alt="Service icon preview"
        />
      )}
      <label>
        Upload or replace icon
        <input
          type="file"
          accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={upload}
        />
      </label>
      <p className="muted">
        SVG, PNG, JPEG or WebP, up to 256 KB. Use a static SVG with no scripts
        or linked images.
      </p>
      {uploading && <p role="status">Uploading icon...</p>}
      {uploading && (
        <progress
          aria-label="Icon upload progress"
          max={100}
          value={progress}
        />
      )}
      {uploaded && (
        <p role="status">Icon uploaded. Save your changes to use it.</p>
      )}
      {error && (
        <p role="alert" className="safe-error">
          {error}
        </p>
      )}
      {preview && (
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            onChange(null, "");
            setError("");
            setUploaded(false);
          }}
        >
          Remove icon
        </button>
      )}
    </div>
  );
}
