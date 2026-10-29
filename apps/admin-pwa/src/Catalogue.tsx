import {
  ImageWithFallback,
  ConfirmActionDialog,
  AppButton,
  AppTabs,
} from "@home/ui";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  indicativePrice,
  type CatalogueOption,
  type ServiceFormField,
} from "@home/shared";
import { AsyncActionButton, useSafeMutation } from "@home/ui";
import { toast } from "sonner";
import { api } from "./api";
import { icons, adminKeys } from "./design";
import {
  PageHeader,
  PageToolbar,
  SearchField,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "./components";
import { CatalogueEditor } from "./CatalogueEditor";
import { ServiceIconEditor } from "./ServiceIconEditor";
import {
  ApplianceCatalogueSettings,
  type ManagedAppliance,
} from "./ApplianceCatalogueSettings";
export type ManagedService = {
  id: string;
  name: string;
  appliance_category_id: string;
  appliance_name: string;
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
  });
  const [type, setType] = useState<"SERVICE" | "INSTALLATION">("SERVICE"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [editing, setEditing] = useState<ManagedService | "new" | null>(null);
  const qc = useQueryClient();
  const [manageAppliances, setManageAppliances] = useState(false);
  const [iconService, setIconService] = useState<ManagedService | null>(null);
  const [unpublishing, setUnpublishing] = useState<ManagedService | null>(null);
  const [publicationError, setPublicationError] = useState("");
  const publish = useSafeMutation(async (s: ManagedService) => {
    await api.patch(`/catalogue/services/${s.id}`, {
      name: s.name,
      applianceCategoryId: s.appliance_category_id,
      requestType: s.request_type,
      formFields: s.form_fields,
      publicationStatus:
        s.publication_status === "DRAFT" ? "PUBLISHED" : "DRAFT",
    });
    await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
    return true;
  });
  const rows =
    q.data?.services.filter(
      (s) =>
        s.request_type === type &&
        (!status || (s.publication_status || "PUBLISHED") === status) &&
        `${s.name} ${s.appliance_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  const groups =
    q.data?.categories
      .map((category) => ({
        ...category,
        services: rows.filter((s) => s.appliance_category_id === category.id),
      }))
      .filter((category) => category.services.length) || [];
  return (
    <section className="catalogue-page">
      <PageHeader
        title="Services & Installations"
        description="Choose an appliance and manage its services and installations."
        actions={
          canManage && (
            <button className="primary" onClick={() => setEditing("new")}>
              <icons.add /> Add{" "}
              {type === "SERVICE" ? "Service" : "Installation"}
            </button>
          )
        }
      />
      {canManage && (
        <div className="catalogue-appliance-controls">
          <button onClick={() => setManageAppliances(true)}>
            Manage Appliances
          </button>
        </div>
      )}
      <AppTabs
        label="Catalogue type"
        value={type}
        onChange={(value) => setType(value as "SERVICE" | "INSTALLATION")}
        items={[
          { value: "SERVICE", label: "Services" },
          { value: "INSTALLATION", label: "Installations" },
        ]}
      >
        <PageToolbar>
          <SearchField
            onClear={() => {
              setSearch("");
            }}
            busy={q.isFetching}
            aria-label="Search services"
            placeholder="Appliance or service name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label>
            Publication
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All services</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
          </label>
          <AsyncActionButton pending={q.isFetching} onClick={() => q.refetch()}>
            Refresh
          </AsyncActionButton>
        </PageToolbar>
        {q.isPending ? (
          <LoadingSkeleton variant="table" />
        ) : q.isError ? (
          <ErrorState
            title="Unable to load catalogue"
            retry={() => q.refetch()}
          />
        ) : !rows.length ? (
          <EmptyState
            title="No services match"
            description="Add a service or adjust your filters."
          />
        ) : (
          <div className="catalogue-appliance-groups">
            {groups.map((group) => (
              <section
                className="catalogue-appliance-group"
                key={group.id}
                aria-label={group.name}
              >
                <div className="catalogue-appliance-heading">
                  <h2>{group.name}</h2>
                  <span>
                    {group.services.length}{" "}
                    {type === "SERVICE"
                      ? group.services.length === 1
                        ? "service"
                        : "services"
                      : group.services.length === 1
                        ? "installation"
                        : "installations"}
                  </span>
                </div>
                <div className="catalogue-management-grid">
                  {group.services.map((s) => (
                    <article
                      className="ui-panel catalogue-management-card"
                      key={s.id}
                    >
                      <div className="catalogue-card-top">
                        <div className="catalogue-card-icon">
                          {s.icon_preview_url ? (
                            <ImageWithFallback
                              src={s.icon_preview_url}
                              alt=""
                            />
                          ) : (
                            <icons.service />
                          )}
                        </div>
                        <span
                          className={`badge status-${s.publication_status === "DRAFT" ? "warning" : "success"}`}
                        >
                          {s.publication_status === "DRAFT"
                            ? "Draft"
                            : "Published"}
                        </span>
                      </div>
                      <div className="catalogue-service-heading">
                        <h3>{s.name}</h3>
                      </div>
                      <div className="catalogue-card-details">
                        <p className="catalogue-card-price">
                          {s.booking_options?.find((o) => o.active)
                            ? indicativePrice(
                                s.booking_options.find((o) => o.active)!,
                              )
                            : s.base_price != null
                              ? `From \u20b9${Number(s.base_price).toLocaleString("en-IN")}`
                              : "Quote after inspection"}
                        </p>
                        <small className="catalogue-card-options">
                          {s.booking_options?.filter((o) => o.active).length ||
                            0}{" "}
                          {s.booking_options?.filter((o) => o.active).length ===
                          1
                            ? "booking option"
                            : "booking options"}
                        </small>
                      </div>
                      {canManage && (
                        <div className="workflow-actions">
                          <button onClick={() => setEditing(s)}>
                            <icons.edit /> Edit
                          </button>
                          <button onClick={() => setIconService(s)}>
                            Change icon
                          </button>
                          <AsyncActionButton
                            pending={publish.isPending}
                            onClick={async () => {
                              if (s.publication_status !== "DRAFT") {
                                setPublicationError("");
                                setUnpublishing(s);
                                return;
                              }
                              try {
                                if (await publish.run(s))
                                  toast.success(
                                    s.publication_status === "DRAFT"
                                      ? "Service published."
                                      : "Service unpublished.",
                                  );
                              } catch {
                                toast.error(
                                  "Unable to change publication status. Check the service options.",
                                );
                              }
                            }}
                          >
                            {s.publication_status === "DRAFT"
                              ? "Publish"
                              : "Unpublish"}
                          </AsyncActionButton>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </AppTabs>
      {iconService && (
        <ServiceIconEditor
          key={iconService.id}
          service={iconService}
          onClose={() => setIconService(null)}
        />
      )}
      {unpublishing && (
        <ConfirmActionDialog
          title="Unpublish service?"
          pending={publish.isPending}
          onClose={() => setUnpublishing(null)}
        >
          <div className="customer-modal-content">
            <p>
              {unpublishing.name} will be hidden from new customer bookings.
              Existing requests keep their service details.
            </p>
            {publicationError && (
              <p className="safe-error" role="alert">
                {publicationError}
              </p>
            )}
          </div>
          <footer>
            <AppButton
              variant="outline"
              disabled={publish.isPending}
              onClick={() => setUnpublishing(null)}
            >
              Keep published
            </AppButton>
            <AppButton
              variant="destructive"
              pending={publish.isPending}
              pendingLabel="Unpublishing..."
              onClick={async () => {
                setPublicationError("");
                try {
                  if (await publish.run(unpublishing)) {
                    toast.success("Service unpublished.");
                    setUnpublishing(null);
                  }
                } catch {
                  setPublicationError(
                    "Unable to unpublish this service. Try again.",
                  );
                }
              }}
            >
              Unpublish service
            </AppButton>
          </footer>
        </ConfirmActionDialog>
      )}
      {editing && q.data && (
        <CatalogueEditor
          key={editing === "new" ? `new-${type}` : editing.id}
          service={editing === "new" ? null : editing}
          type={type}
          data={q.data}
          onClose={() => setEditing(null)}
        />
      )}
      {manageAppliances && q.data && (
        <ApplianceCatalogueSettings
          categories={q.data.categories}
          onClose={() => setManageAppliances(false)}
        />
      )}
    </section>
  );
}
