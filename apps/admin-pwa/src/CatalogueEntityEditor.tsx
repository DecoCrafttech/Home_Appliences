import { useEffect, useState, type FormEvent } from "react";
import { AppButton, ConfirmActionDialog, useSafeMutation } from "@home/ui";
import axios from "axios";
import { api } from "./api";
import { CatalogueImageUpload } from "./CatalogueImageUpload";
import type { ManagedGroup, ManagedItem } from "./Catalogue";

export function CatalogueEntityEditor({
  kind,
  row,
  parentId,
  groups,
  onClose,
  onSaved,
}: {
  kind: "categories" | "items";
  row?: ManagedGroup | ManagedItem;
  parentId?: string;
  groups: ManagedGroup[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(row?.name || "");
  const [description, setDescription] = useState(row?.description || "");
  const [image, setImage] = useState(row?.icon_object_key || null);
  const [preview, setPreview] = useState(row?.icon_preview_url || "");
  const [parent, setParent] = useState(
    (row as ManagedItem)?.catalogue_category_id || parentId || "",
  );
  const [active, setActive] = useState(row?.active ?? true);
  const [status, setStatus] = useState(row?.publication_status || "DRAFT");
  const [order, setOrder] = useState(row?.display_order || 0);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState("");
  const [leaving, setLeaving] = useState(false);
  const snapshot = JSON.stringify({
    name,
    description,
    image,
    parent,
    active,
    status,
    order,
  });
  const [original] = useState(snapshot);
  const dirty = snapshot !== original;
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  const mutation = useSafeMutation(async () => {
    const body = {
      name: name.trim(),
      description,
      iconObjectKey: image,
      active,
      publicationStatus: status,
      displayOrder: order,
      ...(kind === "items" ? { categoryId: parent } : {}),
    };
    if (row) await api.patch(`/catalogue/${kind}/${row.id}`, body);
    else await api.post(`/catalogue/${kind}`, body);
    await onSaved();
    return true;
  });
  function close() {
    if (dirty) setLeaving(true);
    else onClose();
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setFailure("");
    try {
      if (await mutation.run(undefined)) onClose();
    } catch (error) {
      setFailure(
        axios.isAxiosError(error)
          ? error.response?.data?.error?.message || "Unable to save. Try again."
          : "Unable to save. Try again.",
      );
    }
  }
  return (
    <ConfirmActionDialog
      title={`${row ? "Edit" : "Create"} ${kind === "items" ? "item" : "category"}`}
      onClose={close}
      pending={mutation.isPending || uploading}
      drawer
    >
      {leaving ? (
        <div className="catalogue-entity-form">
          <h3>Discard unsaved changes?</h3>
          <p>Your changes have not been saved.</p>
          <button className="primary" onClick={() => setLeaving(false)}>
            Keep editing
          </button>
          <button className="secondary" onClick={onClose}>
            Discard changes
          </button>
        </div>
      ) : (
        <form className="catalogue-entity-form" onSubmit={save}>
          <fieldset disabled={mutation.isPending || uploading}>
            <label>
              Name
              <input
                autoFocus
                value={name}
                minLength={2}
                maxLength={120}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {kind === "items" && (
              <label>
                Category
                <select
                  aria-label="Category"
                  required
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">Choose category</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Description (optional)
              <textarea
                value={description}
                maxLength={1500}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="catalogue-form-row">
              <label>
                Visibility
                <select
                  aria-label="Visibility"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "DRAFT" | "PUBLISHED")
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </label>
              <label>
                Display order
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="catalogue-checkbox">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Enabled for customers
            </label>
          </fieldset>
          <CatalogueImageUpload
            preview={preview}
            onChange={(key, url) => {
              setImage(key);
              setPreview(url);
            }}
            onBusyChange={setUploading}
          />
          {failure && (
            <p role="alert" className="safe-error">
              {failure}
            </p>
          )}
          <footer>
            <AppButton
              variant="outline"
              disabled={mutation.isPending || uploading}
              type="button"
              onClick={close}
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              variant="primary"
              pending={mutation.isPending}
              disabled={uploading}
            >
              Save
            </AppButton>
          </footer>
        </form>
      )}
    </ConfirmActionDialog>
  );
}
