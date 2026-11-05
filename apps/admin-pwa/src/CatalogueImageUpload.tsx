import { ImageWithFallback } from "@home/ui";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import axios from "axios";
import { api, catalogueImageUrl } from "./api";

async function prepare(
  file: File,
  framing: string,
): Promise<{ data: string; contentType: string }> {
  if (
    file.type === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg")
  ) {
    if (file.size > 262144)
      throw new Error("SVG files must be smaller than 256 KB.");
    return { data: await encode(file), contentType: "image/svg+xml" };
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const ratio = framing === "square" ? 1 : 4 / 3;
    canvas.width = 960;
    canvas.height = Math.round(960 / ratio);
    const ctx = canvas.getContext("2d")!;
    const scale =
      framing === "fit"
        ? Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height)
        : Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    ctx.drawImage(
      bitmap,
      (canvas.width - bitmap.width * scale) / 2,
      (canvas.height - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Unable to prepare this image.")),
        "image/webp",
        0.9,
      ),
    );
    if (blob.size > 2097152)
      throw new Error("This image is still too large. Choose a smaller image.");
    return { data: await encode(blob), contentType: "image/webp" };
  } finally {
    bitmap.close();
  }
}
function encode(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]!);
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}
export function CatalogueImageUpload({
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
  const [progress, setProgress] = useState(0);
  const [local, setLocal] = useState("");
  const [framing, setFraming] = useState("fit");
  const busy = useRef(false);
  const uploaded = useRef<string[]>([]);
  const initialMediaId = useRef(
    preview.match(/\/catalogue\/media\/([a-f0-9-]{36})(?:$|\?)/i)?.[1],
  );
  useEffect(
    () => () => {
      const ids = [
        ...new Set([
          ...uploaded.current,
          ...(initialMediaId.current ? [initialMediaId.current] : []),
        ]),
      ];
      if (ids.length)
        void fetch(api.getUri({ url: "/catalogue/media/cleanup" }), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ ids }),
        }).catch(() => {
          /* A later cleanup can retry; referenced images are always retained. */
        });
    },
    [],
  );
  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy.current) return;
    setError("");
    const contentType =
      file.type ||
      (
        {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          svg: "image/svg+xml",
        } as Record<string, string>
      )[file.name.split(".").pop()?.toLowerCase() || ""];
    if (
      !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
        contentType || "",
      )
    ) {
      setError("Choose a PNG, WebP or JPEG image (or a static SVG).");
      return;
    }
    if (!file.size || file.size > 10485760) {
      setError("Choose a non-empty image smaller than 10 MB.");
      return;
    }
    busy.current = true;
    setUploading(true);
    onBusyChange(true);
    setProgress(0);
    setLocal(URL.createObjectURL(file));
    try {
      const prepared = await prepare(file, framing);
      const result = await api.post<{
        data: { id: string; object_key: string; previewUrl: string };
      }>("/catalogue/media", prepared, {
        headers: { "Idempotency-Key": crypto.randomUUID() },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      uploaded.current.push(result.data.data.id);
      onChange(result.data.data.object_key, result.data.data.previewUrl);
      setLocal("");
    } catch (cause) {
      setLocal("");
      setError(
        axios.isAxiosError(cause)
          ? cause.response?.data?.error?.message ||
              "Upload failed. Check your connection and try again."
          : cause instanceof Error
            ? cause.message
            : "Unable to prepare this image.",
      );
    } finally {
      busy.current = false;
      setUploading(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="catalogue-image-upload" aria-busy={uploading}>
      <div className="catalogue-image-preview">
        {local || preview ? (
          <ImageWithFallback
            src={local || catalogueImageUrl(preview)}
            alt="Catalogue image preview"
          />
        ) : (
          <span>No image selected</span>
        )}
      </div>
      <label>
        Image framing
        <select
          value={framing}
          disabled={uploading}
          onChange={(e) => setFraming(e.target.value)}
        >
          <option value="fit">Fit entire image (preserve transparency)</option>
          <option value="cover">Centre crop to 4:3</option>
          <option value="square">Centre crop to square</option>
        </select>
      </label>
      <label className="catalogue-upload-label">
        {preview ? "Replace image" : "Upload image"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
          disabled={uploading}
          onChange={upload}
        />
      </label>
      <small>
        PNG, WebP or JPEG up to 10 MB, optimized before uploading. Static SVG up
        to 256 KB.
      </small>
      {uploading && (
        <div role="status">
          <span>
            {progress === 100
              ? "Saving image..."
              : "Preparing / uploading image..."}
          </span>
          <progress
            max={100}
            value={progress}
            aria-label="Image upload progress"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="safe-error">
          {error}
        </p>
      )}
      {preview && (
        <button
          type="button"
          className="secondary"
          disabled={uploading}
          onClick={() => {
            onChange(null, "");
            setError("");
          }}
        >
          Remove image
        </button>
      )}
    </div>
  );
}
