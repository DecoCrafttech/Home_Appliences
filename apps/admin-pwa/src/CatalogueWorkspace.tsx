import { useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppButton,
  ConfirmActionDialog,
  ImageWithFallback,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import {
  FaArrowDown,
  FaArrowUp,
  FaGripVertical,
  FaLayerGroup,
  FaPlus,
  FaPen,
  FaBoxArchive,
} from "react-icons/fa6";
import { api, catalogueImageUrl } from "./api";
import { adminKeys } from "./design";
import {
  PageHeader,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
} from "./components";
import { CatalogueEntityEditor } from "./CatalogueEntityEditor";
import { CatalogueBannerEditor } from "./CatalogueBannerEditor";
import { CatalogueEditor } from "./CatalogueEditor";
import type {
  ManagedCatalogue,
  ManagedGroup,
  ManagedItem,
  ManagedService,
} from "./Catalogue";
import "./catalogue-workspace.css";

type Entity = "categories" | "items" | "entries";
export function CatalogueWorkspace({ canManage }: { canManage: boolean }) {
  const q = useQuery({
    queryKey: adminKeys.catalogue,
    queryFn: async () =>
      (await api.get<{ data: ManagedCatalogue }>("/catalogue")).data.data,
    refetchOnWindowFocus: true,
  });
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null),
    [itemId, setItemId] = useState<string | null>(null),
    [type, setType] = useState<"SERVICE" | "INSTALLATION">("SERVICE"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [edit, setEdit] = useState<{
      kind: "categories" | "items";
      row?: ManagedGroup | ManagedItem;
    } | null>(null),
    [entry, setEntry] = useState<ManagedService | "new" | null>(null),
    [archive, setArchive] = useState<{
      kind: Entity;
      id: string;
      name: string;
    } | null>(null),
    [failure, setFailure] = useState(""),
    [dragged, setDragged] = useState<string | null>(null),
    [banner, setBanner] = useState(false);
  const group = q.data?.groups?.find((g) => g.id === groupId),
    item = q.data?.categories.find((i) => i.id === itemId);
  const entity: Entity = item ? "entries" : group ? "items" : "categories";
  const all: (ManagedGroup | ManagedItem | ManagedService)[] = item
    ? q.data?.services.filter(
        (s) => s.appliance_category_id === item.id && s.request_type === type,
      ) || []
    : group
      ? q.data?.categories.filter(
          (i) => i.catalogue_category_id === group.id,
        ) || []
      : q.data?.groups || [];
  const sorted = [...all].sort(
    (a, b) =>
      (a.display_order || 0) - (b.display_order || 0) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
  const visible = sorted.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" ||
        (status === "active" ? r.active !== false : r.active === false)),
  );
  async function refresh() {
    await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
  }
  const mutation = useSafeMutation(async (action: () => Promise<unknown>) => {
    await action();
    await refresh();
    return true;
  });
  async function act(action: () => Promise<unknown>, message: string) {
    setFailure("");
    try {
      if (await mutation.run(action)) toast.success(message);
    } catch (error) {
      const text = axios.isAxiosError(error)
        ? error.response?.data?.error?.message ||
          "Unable to save. Refresh and try again."
        : "Unable to save. Try again.";
      setFailure(text);
      toast.error(text);
    }
  }
  function navigate(g: string | null, i: string | null = null) {
    setGroupId(g);
    setItemId(i);
    setSearch("");
    setStatus("all");
  }
  function toggle(row: ManagedGroup | ManagedItem | ManagedService) {
    void act(
      () =>
        api.patch(`/catalogue/${entity}/${row.id}`, {
          active: row.active === false,
        }),
      "Visibility updated.",
    );
  }
  function reorder(from: string, to: string) {
    if (from === to || search || status !== "all") return;
    const ids = sorted.map((r) => r.id);
    const start = ids.indexOf(from),
      end = ids.indexOf(to);
    if (start < 0 || end < 0) return;
    ids.splice(end, 0, ids.splice(start, 1)[0]!);
    void act(
      () =>
        api.put("/catalogue/order", {
          entity,
          ids,
          ...(entity !== "categories"
            ? { parentId: item?.id || group?.id }
            : {}),
          ...(entity === "entries" ? { requestType: type } : {}),
        }),
      "Order saved.",
    );
  }
  function drop(e: DragEvent, id: string) {
    e.preventDefault();
    const from = e.dataTransfer.getData("text/plain");
    setDragged(null);
    if (canManage) reorder(from, id);
  }
  const canOrder =
    canManage && !search && status === "all" && !mutation.isPending;
  return (
    <section className="catalogue-workspace">
      <PageHeader
        title="Service Catalogue"
        description={
          item?.name ||
          group?.name ||
          "Categories, items, services and installations"
        }
        actions={
          canManage && (
            <div className="catalogue-workspace-actions">
              <button className="secondary" onClick={() => setBanner(true)}>
                Home banner
              </button>
              <button
                className="secondary"
                disabled={mutation.isPending}
                onClick={() =>
                  void act(
                    () => api.post("/catalogue/media/cleanup", {}),
                    "Unused images older than 24 hours cleaned up.",
                  )
                }
              >
                Clean unused images
              </button>
              <button
                className="primary"
                onClick={() =>
                  item
                    ? setEntry("new")
                    : setEdit({ kind: group ? "items" : "categories" })
                }
              >
                <FaPlus />
                {item
                  ? `Add ${type === "INSTALLATION" ? "installation" : "service"}`
                  : group
                    ? "Add item"
                    : "Create category"}
              </button>
            </div>
          )
        }
      />
      <nav className="catalogue-breadcrumbs" aria-label="Catalogue breadcrumb">
        <button onClick={() => navigate(null)}>Categories</button>
        {group && (
          <>
            <span>/</span>
            <button onClick={() => navigate(group.id)}>{group.name}</button>
          </>
        )}
        {item && (
          <>
            <span>/</span>
            <span aria-current="page">{item.name}</span>
          </>
        )}
      </nav>
      {failure && (
        <p role="alert" className="safe-error">
          {failure}
        </p>
      )}
      {q.isPending ? (
        <LoadingSkeleton variant="cards" />
      ) : q.isError ? (
        <ErrorState
          title="Unable to load catalogue"
          retry={() => q.refetch()}
        />
      ) : (
        <>
          {item && (
            <div
              className="catalogue-entry-tabs"
              role="tablist"
              aria-label="Entry type"
            >
              {(
                [
                  ["SERVICE", "Services"],
                  ["INSTALLATION", "Installation"],
                ] as const
              ).map(([value, label]) => (
                <button
                  role="tab"
                  aria-selected={type === value}
                  key={value}
                  onClick={() => {
                    setType(value);
                    setSearch("");
                  }}
                >
                  {label}
                  <span>
                    {
                      q.data!.services.filter(
                        (s) =>
                          s.appliance_category_id === item.id &&
                          s.request_type === value,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="catalogue-workspace-toolbar">
            <label>
              Search {item ? "entries" : group ? "items" : "categories"}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Enabled</option>
                <option value="inactive">Disabled</option>
              </select>
            </label>
            <button
              className="secondary"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              Refresh
            </button>
          </div>
          {canManage && (
            <p className="catalogue-order-help">
              Drag the handle to reorder, or use the arrow buttons. Changes save
              immediately.
            </p>
          )}
          <div className="catalogue-workspace-grid">
            {visible.map((row) => {
              const itemRow = row as ManagedItem,
                service = row as ManagedService;
              const image = row.icon_preview_url;
              const children =
                entity === "categories"
                  ? q.data!.categories.filter(
                      (i) => i.catalogue_category_id === row.id,
                    )
                  : entity === "items"
                    ? q.data!.services.filter(
                        (s) => s.appliance_category_id === row.id,
                      )
                    : [];
              const open = () => {
                if (entity === "categories") navigate(row.id);
                else if (entity === "items") navigate(group!.id, row.id);
                else if (canManage) setEntry(service);
              };
              const index = sorted.findIndex((r) => r.id === row.id);
              return (
                <article
                  className={`catalogue-visual-card ${dragged === row.id ? "is-dragging" : ""}`}
                  key={row.id}
                  onDragOver={(e) => {
                    if (canOrder) e.preventDefault();
                  }}
                  onDrop={(e) => drop(e, row.id)}
                >
                  <button
                    className="catalogue-visual-cover"
                    onClick={open}
                    aria-label={`Open ${row.name}`}
                    disabled={entity === "entries" && !canManage}
                  >
                    {image ? (
                      <ImageWithFallback
                        src={catalogueImageUrl(image)}
                        alt=""
                        fallback={<FaLayerGroup />}
                      />
                    ) : (
                      <FaLayerGroup aria-hidden="true" />
                    )}
                  </button>
                  <div className="catalogue-visual-body">
                    <button
                      className="catalogue-card-title"
                      onClick={open}
                      disabled={entity === "entries" && !canManage}
                    >
                      <h2>{row.name}</h2>
                    </button>
                    {entity === "categories" ? (
                      <p>{children.length} items</p>
                    ) : entity === "items" ? (
                      <p>
                        {
                          (children as ManagedService[]).filter(
                            (s) => s.request_type === "SERVICE",
                          ).length
                        }{" "}
                        services ·{" "}
                        {
                          (children as ManagedService[]).filter(
                            (s) => s.request_type === "INSTALLATION",
                          ).length
                        }{" "}
                        installations
                      </p>
                    ) : (
                      service.description && (
                        <p className="catalogue-card-description">
                          {service.description}
                        </p>
                      )
                    )}
                    <div className="catalogue-card-status">
                      <span
                        className={
                          row.publication_status === "PUBLISHED" &&
                          row.active !== false
                            ? "is-live"
                            : ""
                        }
                      >
                        {row.active === false
                          ? "Disabled"
                          : row.publication_status === "PUBLISHED"
                            ? "Published"
                            : "Draft"}
                      </span>
                      {canManage && (
                        <button
                          role="switch"
                          aria-checked={row.active !== false}
                          aria-label={`Enable ${row.name}`}
                          disabled={mutation.isPending}
                          onClick={() => toggle(row)}
                        >
                          {row.active === false ? "Enable" : "Disable"}
                        </button>
                      )}
                    </div>
                    {canManage && (
                      <div className="catalogue-card-actions">
                        <button
                          className="secondary"
                          aria-label={`Edit ${row.name}`}
                          onClick={() =>
                            entity === "entries"
                              ? setEntry(service)
                              : setEdit({
                                  kind: entity,
                                  row:
                                    entity === "items"
                                      ? itemRow
                                      : (row as ManagedGroup),
                                })
                          }
                        >
                          <FaPen />
                          Edit
                        </button>
                        <button
                          className="catalogue-archive"
                          aria-label={`Archive ${row.name}`}
                          onClick={() => {
                            setFailure("");
                            setArchive({
                              kind: entity,
                              id: row.id,
                              name: row.name,
                            });
                          }}
                        >
                          <FaBoxArchive />
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="catalogue-order-controls">
                      <button
                        draggable={canOrder}
                        disabled={!canOrder}
                        aria-label={`Drag ${row.name}`}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", row.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragged(row.id);
                        }}
                        onDragEnd={() => setDragged(null)}
                      >
                        <FaGripVertical />
                      </button>
                      <button
                        aria-label={`Move ${row.name} up`}
                        disabled={!canOrder || index === 0}
                        onClick={() => reorder(row.id, sorted[index - 1]!.id)}
                      >
                        <FaArrowUp />
                      </button>
                      <button
                        aria-label={`Move ${row.name} down`}
                        disabled={!canOrder || index === sorted.length - 1}
                        onClick={() => reorder(row.id, sorted[index + 1]!.id)}
                      >
                        <FaArrowDown />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!visible.length && (
            <EmptyState
              title={
                search || status !== "all"
                  ? "No matching items"
                  : item
                    ? "No entries yet"
                    : group
                      ? "No items yet"
                      : "No categories yet"
              }
              description="Create your catalogue here. Published, enabled entries appear for customers."
              primaryAction={
                canManage && (
                  <button
                    className="primary"
                    onClick={() =>
                      item
                        ? setEntry("new")
                        : setEdit({ kind: group ? "items" : "categories" })
                    }
                  >
                    <FaPlus />
                    Add {item ? "entry" : group ? "item" : "category"}
                  </button>
                )
              }
            />
          )}
        </>
      )}
      {edit && (
        <CatalogueEntityEditor
          key={edit.row?.id || `new-${edit.kind}-${groupId}`}
          kind={edit.kind}
          row={edit.row}
          parentId={groupId || undefined}
          groups={q.data?.groups || []}
          onClose={() => setEdit(null)}
          onSaved={async () => {
            await refresh();
            toast.success("Catalogue saved.");
          }}
        />
      )}
      {entry && q.data && item && (
        <CatalogueEditor
          key={entry === "new" ? `new-${type}-${item.id}` : entry.id}
          service={entry === "new" ? null : entry}
          type={type}
          initialCategory={item.id}
          data={q.data}
          onClose={() => setEntry(null)}
        />
      )}
      {banner && (
        <CatalogueBannerEditor
          banner={q.data?.banner}
          onClose={() => setBanner(false)}
          onSaved={async () => {
            await refresh();
            toast.success("Home banner saved.");
          }}
        />
      )}
      {archive && (
        <ConfirmActionDialog
          title={`Archive ${archive.name}?`}
          pending={mutation.isPending}
          onClose={() => setArchive(null)}
        >
          <div className="catalogue-entity-form">
            <p>
              This hides the{" "}
              {archive.kind === "categories"
                ? "category and its items"
                : archive.kind === "items"
                  ? "item and its entries"
                  : "entry"}{" "}
              from new bookings. Existing request history is preserved.
            </p>
            {failure && <p role="alert">{failure}</p>}
            <footer>
              <AppButton
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => setArchive(null)}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="destructive"
                pending={mutation.isPending}
                onClick={async () => {
                  setFailure("");
                  try {
                    if (
                      await mutation.run(() =>
                        api.delete(
                          `/catalogue/${archive.kind === "entries" ? "services" : archive.kind}/${archive.id}`,
                        ),
                      )
                    ) {
                      toast.success("Archived.");
                      setArchive(null);
                    }
                  } catch (error) {
                    setFailure(
                      axios.isAxiosError(error)
                        ? error.response?.data?.error?.message ||
                            "Unable to archive."
                        : "Unable to archive.",
                    );
                  }
                }}
              >
                Archive
              </AppButton>
            </footer>
          </div>
        </ConfirmActionDialog>
      )}
    </section>
  );
}
