import type { ServiceFormField } from "@home/shared";
import { AppCheckbox } from "@home/ui";
import type { Dispatch, SetStateAction } from "react";
import { icons } from "./design";
export function CatalogueQuestions({
  fields,
  setFields,
}: {
  fields: ServiceFormField[];
  setFields: Dispatch<SetStateAction<ServiceFormField[]>>;
}) {
  function updateField(index: number, patch: Partial<ServiceFormField>) {
    setFields((old) =>
      old.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }
  return (
    <details>
      <summary>Additional booking questions</summary>{" "}
      <h3>Booking form questions</h3>
      <p>
        Customer contact, address, description and visit details are included
        automatically. Add service-specific questions below.
      </p>
      {fields.map((field, index) => (
        <div className="form-question" key={field.key}>
          <label>
            Question
            <input
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
              minLength={2}
              maxLength={100}
              required
              placeholder="e.g. AC type"
            />
          </label>
          <label>
            Answer type
            <select
              value={field.type}
              onChange={(e) =>
                updateField(index, {
                  type: e.target.value as ServiceFormField["type"],
                })
              }
            >
              <option value="text">Short text</option>
              <option value="textarea">Long text</option>
              <option value="select">Dropdown</option>
              <option value="number">Number</option>
            </select>
          </label>
          {field.type === "select" && (
            <label>
              Options (one per line)
              <textarea
                value={field.options.join("\n")}
                onChange={(e) =>
                  updateField(index, {
                    options: e.target.value.split("\n"),
                  })
                }
                required
                placeholder={"Split AC\nWindow AC"}
              />
            </label>
          )}
          <label className="check-label">
            <AppCheckbox
              checked={field.required}
              onChange={(e) =>
                updateField(index, { required: e.target.checked })
              }
            />
            Required question
          </label>
          <button
            type="button"
            className="danger"
            onClick={() =>
              setFields((current) => current.filter((_, i) => i !== index))
            }
          >
            Remove question
          </button>
        </div>
      ))}
      <div className="catalogue-actions">
        <button
          type="button"
          disabled={fields.length >= 20}
          onClick={() =>
            setFields((current) => [
              ...current,
              {
                key: `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
                label: "",
                type: "text",
                required: false,
                options: [],
              },
            ])
          }
        >
          <icons.add /> Add question
        </button>
        {!!fields.length && (
          <button
            type="button"
            className="danger"
            onClick={() => setFields([])}
          >
            Remove custom form
          </button>
        )}
      </div>
    </details>
  );
}
