import { useState, type FormEvent } from "react";
import { AppButton, ConfirmActionDialog, useSafeMutation } from "@home/ui";
import axios from "axios";
import { api } from "./api";
import { CatalogueImageUpload } from "./CatalogueImageUpload";
import type { HomeBanner } from "./Catalogue";
const defaults: HomeBanner = {
  headline: "Your Home, Our Expertise",
  description:
    "Appliance repairs, installations & home maintenance made simple.",
  cta: "Explore Services",
  secondary: "Trusted Professionals • Easy Booking • Quick Response",
  iconObjectKey: null,
};
export function CatalogueBannerEditor({
  banner,
  onClose,
  onSaved,
}: {
  banner?: HomeBanner | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(banner || defaults),
    [preview, setPreview] = useState(banner?.previewUrl || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [leaving, setLeaving] = useState(false);
  const [original] = useState(JSON.stringify(banner || defaults));
  const dirty = JSON.stringify(form) !== original;
  const mutation = useSafeMutation(async () => {
    const { headline, description, cta, secondary, iconObjectKey } = form;
    await api.put("/catalogue/home-banner", {
      headline,
      description,
      cta,
      secondary,
      iconObjectKey,
    });
    await onSaved();
    return true;
  });
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (await mutation.run(undefined)) onClose();
    } catch (cause) {
      setError(
        axios.isAxiosError(cause)
          ? cause.response?.data?.error?.message || "Unable to save banner."
          : "Unable to save banner.",
      );
    }
  }
  function close() {
    if (dirty) setLeaving(true);
    else onClose();
  }
  return (
    <ConfirmActionDialog
      title="Customer home banner"
      onClose={close}
      pending={busy || mutation.isPending}
      drawer
    >
      {leaving ? (
        <div className="catalogue-entity-form">
          <h3>Discard unsaved changes?</h3>
          <button className="primary" onClick={() => setLeaving(false)}>
            Keep editing
          </button>
          <button className="secondary" onClick={onClose}>
            Discard changes
          </button>
        </div>
      ) : (
        <form className="catalogue-entity-form" onSubmit={save}>
          {(
            [
              ["headline", "Headline", 80],
              ["description", "Description", 180],
              ["cta", "Button label", 40],
              ["secondary", "Secondary text", 150],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                value={form[key]}
                maxLength={max}
                required={key === "headline" || key === "cta"}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <CatalogueImageUpload
            preview={preview}
            onChange={(key, url) => {
              setForm({ ...form, iconObjectKey: key });
              setPreview(url);
            }}
            onBusyChange={setBusy}
          />
          <small>
            The banner button opens the customer service categories.
          </small>
          {error && <p role="alert">{error}</p>}
          <footer>
            <AppButton
              type="button"
              variant="outline"
              disabled={busy || mutation.isPending}
              onClick={close}
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              variant="primary"
              pending={mutation.isPending}
              disabled={busy}
            >
              Save banner
            </AppButton>
          </footer>
        </form>
      )}
    </ConfirmActionDialog>
  );
}
