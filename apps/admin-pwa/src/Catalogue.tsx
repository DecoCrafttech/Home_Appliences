import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, ConfirmActionDialog, useSafeMutation } from "@home/ui";
import { appliancePhoto, isMixerGrinder } from "@home/ui/applianceImages";
import { toast } from "sonner";
import axios from "axios";
import type { CatalogueOption, ServiceFormField } from "@home/shared";
import { api } from "./api";
import { icons, adminKeys } from "./design";
import {
  PageHeader,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "./components";
import { CatalogueEditor } from "./CatalogueEditor";
import {
  ApplianceCatalogueSettings,
  type ManagedAppliance,
} from "./ApplianceCatalogueSettings";
export type ManagedService = {
  id: string;
  name: string;
  appliance_category_id: string;
  appliance_name: string;
  category_kind?: string;
  request_type: "SERVICE" | "INSTALLATION";
  description?: string;
  display_order?: number;
  publication_status?: "DRAFT" | "PUBLISHED";
  booking_options?: CatalogueOption[];
  form_fields: ServiceFormField[];
  base_price?: string | null;
  icon_object_key?: string | null;
  icon_url?: string | null;
  icon_preview_url?: string | null;
};
export type ManagedCatalogue = {
  categories: ManagedAppliance[];
  services: ManagedService[];
};

export function Catalogue({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: adminKeys.catalogue,
    queryFn: async () =>
      (await api.get<{ data: ManagedCatalogue }>("/catalogue")).data.data,
    refetchOnWindowFocus: true,
  });
  const [category, setCategory] = useState<ManagedAppliance | null>(null);
  const [editing, setEditing] = useState<ManagedService | "new" | null>(null);
  const [type, setType] = useState<"SERVICE" | "INSTALLATION">("SERVICE");
  const [maintenance, setMaintenance] = useState(false);
  const [manage, setManage] = useState(false);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<ManagedService | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const queryClient = useQueryClient();
  const deletion = useSafeMutation(async (service: ManagedService) => {
    await api.delete(`/catalogue/services/${service.id}`);
    await queryClient.invalidateQueries({ queryKey: adminKeys.catalogue });
    return true;
  });
  function add(value: string) {
    if (value === "category") {
      setManage(true);
      return;
    }
    setType(value === "installation" ? "INSTALLATION" : "SERVICE");
    setMaintenance(value === "maintenance");
    setEditing("new");
  }
  const categories =
    q.data?.categories.filter(
      (c) =>
        !isMixerGrinder(c.name) &&
        c.name.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const selected = q.data?.categories.find((c) => c.id === category?.id);
  return (
    <section className="catalogue-page catalogue-board-page">
      <PageHeader
        title="Services & Installations"
        description={
          selected?.name || "Services, installation and home maintenance"
        }
        actions={
          canManage && (
            <details className="catalogue-add-menu">
              <summary className="primary">
                <icons.add /> Add
              </summary>
              <div>
                {[
                  ["service", "Add Service"],
                  ["installation", "Add Installation"],
                  ["maintenance", "Add Maintenance"],
                  ["category", "Create New Category"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={(event) => {
                      event.currentTarget.closest("details")!.open = false;
                      add(value!);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          )
        }
      />
      {q.isPending ? (
        <LoadingSkeleton variant="cards" />
      ) : q.isError ? (
        <ErrorState
          title="Unable to load catalogue"
          retry={() => q.refetch()}
        />
      ) : selected ? (
        <>
          <div className="ui-toolbar">
            <button className="secondary" onClick={() => setCategory(null)}>
              All categories
            </button>
            {canManage && (
              <button className="secondary" onClick={() => setManage(true)}>
                Edit category
              </button>
            )}
          </div>
          <div className="catalogue-kanban">
            {(selected.kind === "MAINTENANCE"
              ? ["MAINTENANCE"]
              : ["SERVICE", "INSTALLATION"]
            ).map((lane) => {
              const services = q.data!.services.filter(
                (s) =>
                  s.appliance_category_id === selected.id &&
                  s.request_type ===
                    (lane === "INSTALLATION" ? "INSTALLATION" : "SERVICE"),
              );
              return (
                <section className="catalogue-lane" key={lane}>
                  <header>
                    <h2>
                      {lane === "SERVICE"
                        ? "Services"
                        : lane === "INSTALLATION"
                          ? "Installation"
                          : "Maintenance"}
                    </h2>
                    <span>{services.length}</span>
                  </header>
                  {canManage && (
                    <button
                      className="secondary"
                      onClick={() => add(lane.toLowerCase())}
                    >
                      <icons.add /> Add{" "}
                      {lane === "INSTALLATION" ? "installation" : "service"}
                    </button>
                  )}
                  {services.map((service) => (
                    <article
                      className="catalogue-service-tile"
                      key={service.id}
                    >
                      <strong>{service.name}</strong>
                      {service.description && <p>{service.description}</p>}
                      <footer>
                        <span
                          className={`catalogue-state ${service.publication_status?.toLowerCase()}`}
                        >
                          {service.publication_status || "PUBLISHED"}
                        </span>
                        {canManage && (
                          <div className="catalogue-service-actions">
                            <button
                              className="secondary"
                              onClick={() => setEditing(service)}
                            >
                              <icons.edit /> Edit
                            </button>
                            <button
                              className="catalogue-delete-button"
                              aria-label={`Delete ${service.name}`}
                              onClick={() => {
                                setDeleteError("");
                                setDeleting(service);
                              }}
                            >
                              <icons.delete aria-hidden="true" /> Delete
                            </button>
                          </div>
                        )}
                      </footer>
                    </article>
                  ))}
                  {!services.length && <p>No services yet.</p>}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <label className="catalogue-search-label">
            Search categories
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Appliance or category"
            />
          </label>
          <div className="catalogue-category-grid">
            {categories.map((c) => (
              <article className="catalogue-category-tile" key={c.id}>
                {appliancePhoto(c.name) ? (
                  <img src={appliancePhoto(c.name)} alt="" />
                ) : (
                  <span className="catalogue-category-placeholder">
                    <icons.catalogue aria-hidden="true" />
                  </span>
                )}
                <h2>{c.name}</h2>
                <small>
                  {c.kind === "MAINTENANCE"
                    ? "Maintenance"
                    : `${q.data!.services.filter((s) => s.appliance_category_id === c.id).length} services & installations`}
                </small>
                <span className="catalogue-state">
                  {c.publication_status || "PUBLISHED"}
                </span>
                <button className="secondary" onClick={() => setCategory(c)}>
                  {canManage ? "Edit" : "View"} <icons.next />
                </button>
              </article>
            ))}
          </div>
          {!categories.length && <EmptyState title="No matching categories" />}
        </>
      )}
      {editing && q.data && (
        <CatalogueEditor
          key={
            editing === "new"
              ? `new-${type}-${maintenance}-${selected?.id}`
              : editing.id
          }
          service={editing === "new" ? null : editing}
          type={type}
          initialCategory={
            maintenance
              ? q.data.categories.find((c) => c.kind === "MAINTENANCE")?.id
              : selected?.id
          }
          data={{
            ...q.data,
            categories: q.data.categories.filter(
              (c) =>
                !isMixerGrinder(c.name) &&
                (editing !== "new" ||
                  (maintenance
                    ? c.kind === "MAINTENANCE"
                    : c.kind !== "MAINTENANCE")),
            ),
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {manage && q.data && (
        <ApplianceCatalogueSettings
          categories={
            selected
              ? [selected]
              : q.data.categories.filter((c) => !isMixerGrinder(c.name))
          }
          onClose={() => setManage(false)}
        />
      )}
      {deleting && (
        <ConfirmActionDialog
          title="Delete catalogue item?"
          onClose={() => setDeleting(null)}
          pending={deletion.isPending}
        >
          <div className="catalogue-delete-summary">
            <strong>{deleting.name}</strong>
            <p>
              {deleting.appliance_name} ·{" "}
              {deleting.request_type === "INSTALLATION"
                ? "Installation"
                : "Service"}
            </p>
            <p>
              Remove this option from the catalogue? Existing requests keep
              their details.
            </p>
            {deleteError && (
              <p role="alert" className="safe-error">
                {deleteError}
              </p>
            )}
          </div>
          <footer className="catalogue-delete-footer">
            <AppButton
              variant="outline"
              disabled={deletion.isPending}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </AppButton>
            <AppButton
              variant="destructive"
              pending={deletion.isPending}
              pendingLabel="Deleting..."
              onClick={async () => {
                setDeleteError("");
                try {
                  if (await deletion.run(deleting)) {
                    toast.success("Catalogue item deleted.");
                    setDeleting(null);
                  }
                } catch (error) {
                  setDeleteError(
                    axios.isAxiosError(error)
                      ? error.response?.data?.error?.message ||
                          "Unable to delete. Try again."
                      : "Unable to delete. Try again.",
                  );
                }
              }}
            >
              Delete item
            </AppButton>
          </footer>
        </ConfirmActionDialog>
      )}
    </section>
  );
}
