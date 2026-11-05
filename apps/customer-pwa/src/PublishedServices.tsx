import { serviceIcon } from "./servicePresentation";
import { ImageWithFallback, useDebouncedValue } from "@home/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowRight,
  FaXmark,
  FaMagnifyingGlass,
  FaChevronRight,
  FaLayerGroup,
} from "react-icons/fa6";
import { type CatalogueOption } from "@home/shared";
import { api, catalogueImageUrl } from "./lib/api";
import { LoadingSkeleton, EmptyState } from "./components/ui";
export type PublishedService = {
  id: string;
  name: string;
  description: string;
  appliance_category_id: string;
  appliance_name: string;
  catalogue_category_id?: string;
  catalogue_category_name?: string;
  category_kind?: string;
  request_type: "SERVICE" | "INSTALLATION";
  icon_url?: string | null;
  base_price?: string | null;
  booking_options: CatalogueOption[];
};
export type PublishedAppliance = {
  id: string;
  name: string;
  description?: string;
  slug: string;
  kind?: string;
  catalogue_category_id?: string;
  category_name?: string;
  icon_url?: string | null;
  service_count: number;
};
type Category = {
  id: string;
  name: string;
  description: string;
  icon_url?: string | null;
  item_count: number;
};
export function usePublishedCatalogue(enabled = true) {
  return useQuery({
    queryKey: ["published-catalogue"],
    queryFn: async ({ signal }) =>
      (await api.get<{ data: PublishedService[] }>("/catalogue", { signal }))
        .data.data,
    enabled,
    staleTime: 15000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
export function useHomeBanner() {
  return useQuery({
    queryKey: ["customer-home-banner"],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            headline: string;
            description: string;
            cta: string;
            secondary: string;
            icon_url: string | null;
          };
        }>("/catalogue/home-banner")
      ).data.data,
    staleTime: 30000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
function CatalogueImage({ src }: { src?: string | null }) {
  return (
    <ImageWithFallback
      className="appliance-photo"
      src={catalogueImageUrl(src)}
      alt=""
      width={400}
      height={300}
      loading="lazy"
      decoding="async"
      fallback={<FaLayerGroup aria-hidden="true" />}
    />
  );
}
export function ServiceCard({ service }: { service: PublishedService }) {
  const params = new URLSearchParams({
    applianceCategoryId: service.appliance_category_id,
    serviceId: service.id,
  });
  if (service.catalogue_category_id)
    params.set("categoryId", service.catalogue_category_id);
  const Icon = serviceIcon(service.name, service.request_type);
  return (
    <Link
      className="discovery-card service-option"
      to={
        "/request/" +
        (service.request_type === "INSTALLATION" ? "installation" : "service") +
        "?" +
        params
      }
      aria-label={"Book " + service.name}
    >
      <span className="service-option-icon">
        {service.icon_url ? (
          <ImageWithFallback
            className="service-option-photo"
            src={catalogueImageUrl(service.icon_url)}
            alt=""
            width={72}
            height={72}
            fallback={<Icon />}
          />
        ) : (
          <Icon aria-hidden="true" />
        )}
      </span>
      <span className="service-option-copy">
        <h3>{service.name}</h3>
        {service.description && <p>{service.description}</p>}
      </span>
      <FaChevronRight className="service-option-chevron" aria-hidden="true" />
    </Link>
  );
}
function useCatalogueFilters() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const requestedType = params.get("type") || "";
  const type = ["SERVICE", "INSTALLATION"].includes(requestedType)
    ? requestedType
    : "";
  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true, preventScrollReset: true });
  }
  return {
    search,
    type,
    setSearch: (value: string) => update({ q: value }),
    setType: (value: string) => update({ type: value }),
    clear: () => update({ q: "", type: "" }),
  };
}
function Search({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="discovery-search">
      <FaMagnifyingGlass aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <FaXmark aria-hidden="true" />
        </button>
      )}
    </label>
  );
}
export function ServiceDiscovery({ compact = false }: { compact?: boolean }) {
  const { search, setSearch } = useCatalogueFilters();
  const term = useDebouncedValue(search.trim(), 200);
  const q = useQuery({
    queryKey: ["published-appliances"],
    queryFn: async () =>
      (await api.get<{ data: PublishedAppliance[] }>("/catalogue/appliances"))
        .data.data,
    staleTime: 15000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const rows = (q.data || []).filter(
    (c) =>
      compact ||
      `${c.name} ${c.category_name || ""}`
        .toLowerCase()
        .includes(term.toLowerCase()),
  );
  const appliances = compact ? rows.slice(0, 4) : rows;
  const groups = new Map<
    string,
    { name: string; items: PublishedAppliance[] }
  >();
  for (const appliance of appliances) {
    const key = appliance.catalogue_category_id || "items";
    if (!groups.has(key))
      groups.set(key, {
        name: appliance.category_name || "Services",
        items: [],
      });
    groups.get(key)!.items.push(appliance);
  }
  return (
    <section
      className={compact ? "home-discovery" : "section page services-discovery"}
    >
      {compact ? (
        <div className="section-heading">
          <h2>Browse Appliances</h2>
          <Link to="/services">
            View all <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">CARE FOR YOUR HOME</span>
              <h1>Services &amp; Installation</h1>
            </div>
          </div>
          <Search
            label="Search appliances and services"
            value={search}
            onChange={setSearch}
          />
        </>
      )}
      {q.isPending ? (
        <LoadingSkeleton variant="appliances" count={compact ? 4 : 8} />
      ) : q.isError ? (
        <EmptyState
          kind="network"
          title="Unable to load services"
          description="Check your connection and try again."
          primaryAction={
            <button className="primary" onClick={() => q.refetch()}>
              Try again
            </button>
          }
        />
      ) : appliances.length ? (
        <div className="customer-listing-groups">
          {[...groups].map(([id, group]) => (
            <div className="customer-listing-group" key={id}>
              {!compact && (
                <h2 className="customer-listing-heading">{group.name}</h2>
              )}
              <div className="appliance-grid">
                {group.items.map((appliance) => (
                  <Link
                    className="appliance-card"
                    key={appliance.id}
                    to={"/services/appliances/" + appliance.id}
                    aria-label={"View " + appliance.name + " services"}
                  >
                    <div className="appliance-photo-wrap">
                      <CatalogueImage src={appliance.icon_url} />
                    </div>
                    <div className="appliance-card-footer">
                      <h2>{appliance.name}</h2>
                      <FaChevronRight aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          kind={search ? "search" : "catalogue"}
          title={search ? "No matching appliances" : "Services are coming soon"}
          description={
            search
              ? "Try a different appliance or service name."
              : "Check back soon or contact support for help."
          }
          primaryAction={
            search ? (
              <button className="secondary" onClick={() => setSearch("")}>
                Clear search
              </button>
            ) : (
              <Link className="secondary" to="/support">
                Contact support
              </Link>
            )
          }
        />
      )}
    </section>
  );
}
export function CategoryItems() {
  const { categoryId } = useParams();
  const { search, setSearch } = useCatalogueFilters();
  const q = useQuery({
    queryKey: ["category-items", categoryId],
    queryFn: async () =>
      (
        await api.get<{
          data: PublishedAppliance[];
          meta: { category: Category };
        }>(`/catalogue/categories/${categoryId}/items`)
      ).data,
    staleTime: 15000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const rows = (q.data?.data || []).filter((i) =>
    i.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <section className="section page services-discovery">
      <Link className="text-button appliance-back" to="/services">
        All categories
      </Link>
      {q.isPending ? (
        <LoadingSkeleton variant="appliances" />
      ) : q.isError ? (
        <EmptyState
          kind="network"
          title="Category unavailable"
          description="Try again or browse another category."
          primaryAction={
            <button className="primary" onClick={() => q.refetch()}>
              Try again
            </button>
          }
          secondaryAction={
            <Link className="secondary" to="/services">
              Browse categories
            </Link>
          }
        />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <h1>{q.data.meta.category.name}</h1>
              {q.data.meta.category.description && (
                <p>{q.data.meta.category.description}</p>
              )}
            </div>
          </div>
          <Search label="Search items" value={search} onChange={setSearch} />
          {rows.length ? (
            <div className="appliance-grid">
              {rows.map((item) => (
                <Link
                  className="appliance-card"
                  key={item.id}
                  to={"/services/appliances/" + item.id}
                  aria-label={"View " + item.name + " services"}
                >
                  <div className="appliance-photo-wrap">
                    <CatalogueImage src={item.icon_url} />
                  </div>
                  <div className="appliance-card-footer">
                    <h2>{item.name}</h2>
                    <FaChevronRight aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              kind={search ? "search" : "services"}
              title={search ? "No matching items" : "No items available yet"}
              description="Try a different search or check back for new services."
              primaryAction={
                search ? (
                  <button className="secondary" onClick={() => setSearch("")}>
                    Clear search
                  </button>
                ) : (
                  <Link className="secondary" to="/services">
                    Browse categories
                  </Link>
                )
              }
            />
          )}
        </>
      )}
    </section>
  );
}
export function ApplianceServices() {
  const { applianceId } = useParams();
  const { search, setSearch, type, setType, clear } = useCatalogueFilters();
  const q = useQuery({
    queryKey: ["appliance-services", applianceId],
    queryFn: async () =>
      (
        await api.get<{
          data: PublishedService[];
          meta: { appliance: PublishedAppliance };
        }>(`/catalogue/appliances/${applianceId}/services`)
      ).data,
    staleTime: 300_000,
    refetchOnMount: true,
  });
  if (q.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton variant="services" />
      </section>
    );
  if (q.isError)
    return (
      <section className="section page" role="alert">
        <EmptyState
          kind="network"
          title="Services unavailable"
          description="This item may no longer be available, or the connection was interrupted."
          primaryAction={
            <button className="primary" onClick={() => q.refetch()}>
              Try again
            </button>
          }
          secondaryAction={
            <Link className="secondary" to="/services">
              Browse categories
            </Link>
          }
        />
      </section>
    );
  const rows = q.data.data.filter(
    (s) =>
      (!type || s.request_type === type) &&
      `${s.name} ${s.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <section className="section page services-discovery">
      <Link className="text-button appliance-back" to="/services">
        All categories
      </Link>
      <div className="page-heading">
        <div>
          <h1>{q.data.meta.appliance.name}</h1>
          <p>Choose the service or installation you need.</p>
        </div>
      </div>
      <label className="discovery-search">
        <FaMagnifyingGlass />
        <input
          type="search"
          aria-label="Search services"
          placeholder="Search services"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <FaXmark aria-hidden="true" />
          </button>
        )}
      </label>
      <div className="filter-chips">
        {[
          ["", "All"],
          ["SERVICE", "Service"],
          ["INSTALLATION", "Installation"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={type === value}
            onClick={() => setType(value!)}
          >
            {label}
          </button>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState
          kind={search ? "search" : "services"}
          title={
            search || type ? "No matching services" : "No services available"
          }
          description="Choose another appliance or check back for listed services."
          primaryAction={
            <Link to="/services" className="secondary">
              Choose Another Appliance
            </Link>
          }
        >
          {(search || type) && (
            <button className="secondary" onClick={clear}>
              Clear filters
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="discovery-grid">
          {rows.map((service) => (
            <ServiceCard service={service} key={service.id} />
          ))}
        </div>
      )}
    </section>
  );
}
