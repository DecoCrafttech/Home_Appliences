import { ImageWithFallback } from "@home/ui";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { adminKeys } from "./design";
export type ManagedAppliance = {
  id: string;
  name: string;
  icon_object_key?: string | null;
  icon_preview_url?: string | null;
  publication_status?: "DRAFT" | "PUBLISHED";
};
export function ApplianceCatalogueSettings({
  categories,
  onClose,
}: {
  categories: ManagedAppliance[];
  onClose: () => void;
}) {
  const [category, setCategory] = useState(categories[0]?.id || ""),
    [icon, setIcon] = useState(categories[0]?.icon_object_key || null),
    [preview, setPreview] = useState(categories[0]?.icon_preview_url || null),
    [status, setStatus] = useState(
      categories[0]?.publication_status || "PUBLISHED",
    ),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const create = useSafeMutation(async () => {
    await api.post("/catalogue/appliances", { name: newName.trim() });
    await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
    return true;
  });
  const save = useSafeMutation(async () => {
    await api.patch(`/catalogue/appliances/${category}`, {
      iconObjectKey: icon,
      publicationStatus: status,
    });
    await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
    return true;
  });
  return (
    <ConfirmActionDialog
      title="Manage Appliances"
      pending={save.isPending || uploading || create.isPending}
      onClose={onClose}
    >
      <form
        className="change-request-status"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            if (await create.run(undefined)) {
              toast.success("Appliance added as a draft.");
              onClose();
            }
          } catch (cause) {
            setError(
              axios.isAxiosError(cause)
                ? cause.response?.data?.error?.message ||
                    "Unable to add appliance."
                : "Unable to add appliance.",
            );
          }
        }}
      >
        <label>
          New appliance name
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            minLength={2}
            maxLength={100}
            required
            disabled={save.isPending || uploading || create.isPending}
          />
        </label>
        <AsyncActionButton
          pending={create.isPending}
          disabled={save.isPending || uploading}
          pendingLabel="Adding..."
        >
          Add appliance
        </AsyncActionButton>
      </form>
      <form
        className="change-request-status"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (await save.run(undefined)) {
              toast.success("Appliance updated.");
              onClose();
            }
          } catch (e) {
            setError(
              axios.isAxiosError(e)
                ? e.response?.data?.error?.message ||
                    "Unable to save appliance."
                : "Unable to save appliance.",
            );
          }
        }}
      >
        <fieldset disabled={uploading || save.isPending}>
          <label>
            Appliance
            <select
              aria-label="Appliance"
              value={category}
              required
              onChange={(e) => {
                const a = categories.find((c) => c.id === e.target.value)!;
                setCategory(a.id);
                setIcon(a.icon_object_key || null);
                setPreview(a.icon_preview_url || null);
                setStatus(a.publication_status || "PUBLISHED");
              }}
            >
              {categories.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {preview && (
            <ImageWithFallback
              className="catalogue-icon-preview"
              src={preview}
              alt="Appliance icon preview"
            />
          )}
          <label>
            Appliance icon
            <input
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 262144) {
                  setError("Choose an icon smaller than 256 KB.");
                  return;
                }
                setUploading(true);
                setError("");
                try {
                  const encoded = await new Promise<string>(
                    (resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve(String(reader.result).split(",")[1]!);
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    },
                  );
                  const result = await api.post("/catalogue/media", {
                    contentType:
                      file.type ||
                      (file.name.endsWith(".svg") ? "image/svg+xml" : ""),
                    data: encoded,
                  });
                  setIcon(result.data.data.object_key);
                  setPreview(result.data.data.previewUrl);
                } catch {
                  setError(
                    "Unable to upload icon. Check the file and try again.",
                  );
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <label>
            Visibility
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "DRAFT" | "PUBLISHED")
              }
            >
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
          <p className="safe-help">
            Draft appliances and their services are hidden from new customer
            bookings. Existing bookings keep their original details.
          </p>
        </fieldset>
        {error && (
          <p className="safe-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            disabled={uploading || save.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <AsyncActionButton
            className="primary"
            pending={uploading || save.isPending}
            pendingLabel={uploading ? "Uploading..." : "Saving..."}
            disabled={!category}
          >
            Save Appliance
          </AsyncActionButton>
        </footer>
      </form>
    </ConfirmActionDialog>
  );
}
