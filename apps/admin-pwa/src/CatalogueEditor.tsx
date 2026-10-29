import { ImageWithFallback, AppCheckbox } from "@home/ui";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  catalogueOptionsSchema,
  serviceFormSchema,
  indicativePrice,
  type CatalogueOption,
  type ServiceFormField,
} from "@home/shared";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { icons, adminKeys } from "./design";
import type { ManagedService, ManagedCatalogue } from "./Catalogue";
import { CatalogueQuestions } from "./CatalogueQuestions";
import { CatalogueIconUpload } from "./CatalogueIconUpload";
export function CatalogueEditor({
  service,
  type,
  data,
  onClose,
}: {
  service: ManagedService | null;
  type: "SERVICE" | "INSTALLATION";
  data: ManagedCatalogue;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    [name, setName] = useState(service?.name || ""),
    [category, setCategory] = useState(service?.appliance_category_id || ""),
    [description, setDescription] = useState(service?.description || ""),
    [order, setOrder] = useState(service?.display_order || 0),
    [options, setOptions] = useState<CatalogueOption[]>(
      service?.booking_options || [],
    ),
    [fields, setFields] = useState<ServiceFormField[]>(
      service?.form_fields || [],
    ),
    [icon, setIcon] = useState(service?.icon_object_key || null),
    [preview, setPreview] = useState(service?.icon_preview_url || ""),
    [uploading, setUploading] = useState(false),
    [failure, setFailure] = useState("");
  const qc = useQueryClient(),
    actualType = service?.request_type || type;
  const snapshot = {
    name,
    category,
    description,
    order,
    options,
    fields,
    icon,
  };
  const [original] = useState(() => JSON.stringify(snapshot));
  const dirty = JSON.stringify(snapshot) !== original;
  const [leaving, setLeaving] = useState(false);
  function requestClose() {
    if (leaving) setLeaving(false);
    else if (dirty) setLeaving(true);
    else onClose();
  }
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const mutation = useSafeMutation(
    async (publicationStatus: "DRAFT" | "PUBLISHED") => {
      if (name.trim().length < 2 || !category)
        throw new Error("Enter a service name and choose an appliance.");
      if (
        publicationStatus === "PUBLISHED" &&
        data.categories.find((item) => item.id === category)
          ?.publication_status === "DRAFT"
      )
        throw new Error(
          "Publish this appliance in Manage Appliances before publishing its services.",
        );
      const parsed = catalogueOptionsSchema.safeParse(options),
        form = serviceFormSchema.safeParse(fields);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message || "Check option prices.",
        );
      if (!form.success)
        throw new Error(
          form.error.issues[0]?.message || "Check booking questions.",
        );
      if (publicationStatus === "PUBLISHED" && !options.some((o) => o.active))
        throw new Error("Add at least one active option before publishing.");
      const first = options.find((o) => o.active);
      const body = {
        name: name.trim(),
        applianceCategoryId: category,
        requestType: actualType,
        description,
        displayOrder: order,
        publicationStatus,
        options: parsed.data,
        formFields: form.data,
        iconObjectKey: icon,
        basePrice: first?.amountPaise != null ? first.amountPaise / 100 : null,
      };
      if (service) await api.patch(`/catalogue/services/${service.id}`, body);
      else await api.post("/catalogue/services", body);
      await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
      return true;
    },
  );
  const pending = mutation.isPending || uploading;
  function update(id: string, patch: Partial<CatalogueOption>) {
    setOptions((old) => old.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function add(option?: CatalogueOption) {
    setOptions((old) => [
      ...old,
      option
        ? { ...option, id: crypto.randomUUID() }
        : {
            id: crypto.randomUUID(),
            name: "",
            description: "",
            active: true,
            priceType: "QUOTE",
            amountPaise: null,
            maximumPaise: null,
            included: "",
            exclusions: "",
            durationMinutes: null,
          },
    ]);
  }
  async function save(status: "DRAFT" | "PUBLISHED") {
    setFailure("");
    try {
      if (await mutation.run(status)) {
        toast.success(
          status === "PUBLISHED" ? "Service published." : "Draft saved.",
        );
        onClose();
      }
    } catch (error) {
      const text = axios.isAxiosError(error)
        ? error.response?.data?.error?.message ||
          "Unable to save. Please try again."
        : error instanceof Error
          ? error.message
          : "Unable to save.";
      setFailure(text);
      toast.error(text);
    }
  }
  const definitions = [
    ...new Map(
      data.services
        .flatMap((s) => s.booking_options || [])
        .map((o) => [o.name.toLowerCase(), o]),
    ).values(),
  ].filter(
    (o) =>
      !options.some(
        (selected) => selected.name.toLowerCase() === o.name.toLowerCase(),
      ),
  );
  return (
    <ConfirmActionDialog
      title={`${service ? "Edit" : "Add"} ${actualType === "SERVICE" ? "Service" : "Installation"}`}
      pending={pending}
      onClose={requestClose}
      drawer
    >
      {leaving && (
        <div className="customer-modal-content" role="alert">
          <h3>Discard unsaved changes?</h3>
          <p>Your service changes have not been saved.</p>
          <div className="workflow-actions">
            <button type="button" autoFocus onClick={() => setLeaving(false)}>
              Keep editing
            </button>
            <button type="button" className="danger-button" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </div>
      )}
      <div className="catalogue-wizard" hidden={leaving}>
        <ol className="catalogue-steps">
          {["Details", "Icon", "Options & pricing", "Preview"].map(
            (label, i) => (
              <li key={label}>
                <button
                  type="button"
                  aria-current={step === i ? "step" : undefined}
                  disabled={pending}
                  onClick={() => setStep(i)}
                >
                  <span>{label}</span>
                </button>
              </li>
            ),
          )}
        </ol>
        <fieldset disabled={pending}>
          {step === 0 && (
            <>
              <label>
                Appliance
                <select
                  aria-label="Appliance"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select appliance</option>
                  {data.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {data.categories.find((item) => item.id === category)
                ?.publication_status === "DRAFT" && (
                <p className="inline-note">
                  This appliance is a draft. Publish it in Manage Appliances
                  before publishing this service.
                </p>
              )}
              <label>
                Service name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Short description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1500}
                />
              </label>
              <label>
                Display order
                <input
                  type="number"
                  value={order}
                  min={0}
                  max={10000}
                  onChange={(e) => setOrder(Number(e.target.value))}
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              <h3>Service icon</h3>
              <CatalogueIconUpload
                preview={preview}
                onBusyChange={setUploading}
                onChange={(key, url) => {
                  setIcon(key);
                  setPreview(url);
                }}
              />
            </>
          )}
          {step === 2 && (
            <>
              <h3>
                {actualType === "SERVICE"
                  ? "Selectable problems"
                  : "Installation options"}
              </h3>
              <p>Customers can select multiple requirements.</p>
              {!!definitions.length && (
                <details>
                  <summary>Select existing options</summary>
                  <div className="filter-chips">
                    {definitions.map((o) => (
                      <button type="button" key={o.id} onClick={() => add(o)}>
                        <icons.add /> {o.name}
                      </button>
                    ))}
                  </div>
                </details>
              )}
              {options.map((o, index) => (
                <div className="catalogue-option" key={o.id}>
                  <label>
                    Option name
                    <input
                      value={o.name}
                      maxLength={120}
                      onChange={(e) => update(o.id, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={o.description}
                      maxLength={500}
                      onChange={(e) =>
                        update(o.id, { description: e.target.value })
                      }
                    />
                  </label>
                  <label className="check-label">
                    <AppCheckbox
                      checked={o.active}
                      onChange={(e) =>
                        update(o.id, { active: e.target.checked })
                      }
                    />
                    Available for booking
                  </label>
                  <div className="workflow-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setOptions((old) => {
                          const next = [...old];
                          [next[index - 1], next[index]] = [
                            next[index]!,
                            next[index - 1]!,
                          ];
                          return next;
                        })
                      }
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOptions((old) =>
                          old.filter((item) => item.id !== o.id),
                        )
                      }
                    >
                      Remove option
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={options.length >= 30}
                onClick={() => add()}
              >
                <icons.add /> Add option
              </button>
              <CatalogueQuestions fields={fields} setFields={setFields} />
            </>
          )}
          {step === 2 && (
            <>
              <h3>Approximate INR pricing</h3>
              {!options.length && <p>Add booking options first.</p>}
              {options.map((o) => (
                <div className="catalogue-option" key={o.id}>
                  <h4>{o.name || "Unnamed option"}</h4>
                  <label>
                    Price type
                    <select
                      aria-label="Price type"
                      value={o.priceType}
                      onChange={(e) =>
                        update(o.id, {
                          priceType: e.target
                            .value as CatalogueOption["priceType"],
                        })
                      }
                    >
                      <option value="QUOTE">Quote after inspection</option>
                      <option value="FIXED">Fixed indicative price</option>
                      <option value="FROM">Starting from</option>
                      <option value="RANGE">Price range</option>
                      <option value="INSPECTION">
                        Inspection / visit charge
                      </option>
                    </select>
                  </label>
                  {o.priceType !== "QUOTE" && (
                    <label>
                      Amount in INR
                      <input
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        value={o.amountPaise == null ? "" : o.amountPaise / 100}
                        onChange={(e) =>
                          update(o.id, {
                            amountPaise:
                              e.target.value === ""
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </label>
                  )}
                  {o.priceType === "RANGE" && (
                    <label>
                      Maximum in INR
                      <input
                        type="number"
                        min="0"
                        max="10000000"
                        step="0.01"
                        value={
                          o.maximumPaise == null ? "" : o.maximumPaise / 100
                        }
                        onChange={(e) =>
                          update(o.id, {
                            maximumPaise:
                              e.target.value === ""
                                ? null
                                : Math.round(Number(e.target.value) * 100),
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    Included work
                    <textarea
                      value={o.included}
                      onChange={(e) =>
                        update(o.id, { included: e.target.value })
                      }
                      maxLength={1000}
                    />
                  </label>
                  <label>
                    Exclusions / extra charges
                    <textarea
                      value={o.exclusions}
                      onChange={(e) =>
                        update(o.id, { exclusions: e.target.value })
                      }
                      maxLength={1000}
                    />
                  </label>
                  <label>
                    Estimated duration (minutes, optional)
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={o.durationMinutes ?? ""}
                      onChange={(e) =>
                        update(o.id, {
                          durationMinutes:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </>
          )}
          {step === 3 && (
            <div className="catalogue-preview">
              <span className="eyebrow">Customer preview</span>
              {preview && (
                <ImageWithFallback
                  src={preview}
                  alt=""
                  className="catalogue-icon-preview"
                />
              )}
              <h3>
                {data.categories.find((c) => c.id === category)?.name ||
                  "Appliance"}
              </h3>
              <h4>{name || "Service name"}</h4>
              <p>{description}</p>
              {options
                .filter((o) => o.active)
                .map((o) => (
                  <div key={o.id}>
                    <strong>{o.name}</strong>
                    <p>{o.description}</p>
                    <span>{indicativePrice(o)}</span>
                    {o.included && <p>Includes: {o.included}</p>}
                    {o.exclusions && <p>Extra charges: {o.exclusions}</p>}
                  </div>
                ))}
              <small>
                Final charges are confirmed after inspection where needed.
              </small>
            </div>
          )}
        </fieldset>
        {failure && (
          <p role="alert" className="safe-error">
            {failure}
          </p>
        )}
        <footer>
          <button type="button" onClick={requestClose} disabled={pending}>
            Cancel
          </button>
          <AsyncActionButton
            pending={pending}
            pendingLabel="Saving..."
            onClick={() => save("DRAFT")}
          >
            Save Draft
          </AsyncActionButton>
          <AsyncActionButton
            className="primary"
            pending={pending}
            pendingLabel="Publishing..."
            onClick={() => save("PUBLISHED")}
          >
            Publish
          </AsyncActionButton>
        </footer>
      </div>
    </ConfirmActionDialog>
  );
}
