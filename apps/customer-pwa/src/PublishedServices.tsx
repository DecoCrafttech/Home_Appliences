import { serviceIcon } from "./servicePresentation";
import {
  homeAppliances,
  isHiddenCustomerAppliance,
  appliancePhoto,
  appliancePresentation,
} from "./appliancePresentation";
import { ImageWithFallback, useDebouncedValue } from "@home/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowRight,
  FaXmark,
  FaMagnifyingGlass,
  FaChevronRight,
} from "react-icons/fa6";
import { type CatalogueOption } from "@home/shared";
import { api } from "./lib/api";
import { LoadingSkeleton, EmptyState } from "./components/ui";
export type PublishedService = {
  category_kind?: string;
  id: string;
  name: string;
  description: string;
  appliance_category_id: string;
  appliance_name: string;
  request_type: "SERVICE" | "INSTALLATION";
  icon_url?: string | null;
  base_price?: string | null;
  booking_options: CatalogueOption[];
};
export function usePublishedCatalogue(enabled = true) {
  return useQuery({
    queryKey: ["published-catalogue"],
    queryFn: async ({ signal }) =>
      (
        await api.get<{ data: PublishedService[] }>("/catalogue", { signal })
      ).data.data.filter(
        (service) => !isHiddenCustomerAppliance(service.appliance_name),
      ),
    enabled,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 300_000,
  });
}
function ApplianceImage({ name, src }: { name: string; src?: string | null }) {
  return (
    <ImageWithFallback
      className="appliance-photo"
      src={src || appliancePhoto(name)}
      alt=""
      width={400}
      height={300}
      loading="lazy"
      decoding="async"
      fallback={
        <span className="appliance-photo-missing">Photo unavailable</span>
      }
    />
  );
}
export function ServiceCard({ service }: { service: PublishedService }) {
  const bookingParams = new URLSearchParams({
    applianceCategoryId: service.appliance_category_id,
    serviceId: service.id,
  });
  const bookingType =
    service.request_type === "INSTALLATION" ? "installation" : "service";
  const Icon = serviceIcon(service.name, service.request_type);
  return (
    <Link
      className="discovery-card service-option"
      to={`/request/${bookingType}?${bookingParams}`}
      aria-label={`Book ${service.name}`}
    >
      <span className="service-option-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="service-option-copy">
        <h3>{service.name}</h3>
        <p>
          {service.description ||
            `${service.appliance_name} ${service.request_type === "INSTALLATION" ? "installation" : "service"}`}
        </p>
      </span>
      <FaChevronRight className="service-option-chevron" aria-hidden="true" />
    </Link>
  );
}

type PublishedAppliance = {
  kind?: string;
  id: string;
  name: string;
  slug: string;
  icon_url?: string | null;
  service_count: number;
};
function useCatalogueFilters() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const requestedType = params.get("type") || "";
  const type = ["SERVICE", "INSTALLATION"].includes(requestedType)
    ? requestedType
    : "";
  function update(changes: Record<string, string>) {
    // Preserve fast consecutive selections before the route renders again.
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
export function ServiceDiscovery({ compact = false }: { compact?: boolean }) {
  const { search, setSearch } = useCatalogueFilters();
  const settledSearch = useDebouncedValue(search.trim(), 250);
  const q = useQuery({
    queryKey: ["published-appliances"],
    queryFn: async () =>
      (await api.get<{ data: PublishedAppliance[] }>("/catalogue/appliances"))
        .data.data,
    staleTime: 300_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
  const curated = homeAppliances.map((presentation) => ({
    presentation,
    appliance: q.data
      ?.filter((appliance) => appliance.kind !== "MAINTENANCE")
      .find((appliance) =>
        presentation.match.test(`${appliance.name} ${appliance.slug || ""}`),
      ),
  }));
  const extra = (q.data || [])
    .filter(
      (appliance) =>
        appliance.kind !== "MAINTENANCE" &&
        !isHiddenCustomerAppliance(appliance.name) &&
        !isHiddenCustomerAppliance(appliance.slug || "") &&
        !curated.some((row) => row.appliance?.id === appliance.id),
    )
    .map((appliance) => ({
      presentation: appliancePresentation(appliance.name),
      appliance,
    }));
  const rows = [...curated, ...extra];
  const matches = rows.filter(({ presentation, appliance }) =>
    `${presentation.label} ${appliance?.name || ""}`
      .toLowerCase()
      .includes(settledSearch.toLowerCase()),
  );
  const appliances = compact && !settledSearch ? matches.slice(0, 4) : matches;
  return (
    <section
      className={compact ? "home-discovery" : "section page services-discovery"}
    >
      {compact ? (
        <div className="section-heading">
          <h2>Browse Appliances</h2>
          <Link to="/services">
            View All <FaArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">APPLIANCE CARE</span>
              <h1>Services &amp; Installation</h1>
            </div>
          </div>
          <label className="discovery-search">
            <FaMagnifyingGlass aria-hidden="true" />
            <input
              type="search"
              aria-label="Search appliances"
              placeholder="Search appliances"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="search-clear"
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <FaXmark aria-hidden="true" />
              </button>
            )}
          </label>
        </>
      )}
      {q.isPending ? (
        <LoadingSkeleton variant="appliances" count={compact ? 4 : 11} />
      ) : q.isError ? (
        <div role="alert">
          <EmptyState
            kind="network"
            title="Unable to load information"
            description="Check your connection and try loading the appliances again."
            primaryAction={
              <button className="secondary" onClick={() => q.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      ) : appliances.length ? (
        <div className="appliance-grid">
          {appliances.map(({ presentation, appliance }) => {
            const label = appliance?.name || presentation.label;
            return (
              <Link
                className="appliance-card"
                key={appliance?.id || presentation.key}
                to={`/services/appliances/${appliance?.id || `unlisted-${presentation.key}`}`}
                aria-label={`View ${label} services`}
              >
                <div className="appliance-photo-wrap">
                  <ApplianceImage name={label} />
                </div>
                {!appliance && (
                  <span className="appliance-availability">Not listed yet</span>
                )}
                <div className="appliance-card-footer">
                  <h2>{label}</h2>
                  <FaChevronRight aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          kind={search ? "search" : "catalogue"}
          title={
            search ? "No matching appliances" : "No appliances available yet"
          }
          description={
            search
              ? "Try a different appliance name."
              : "Check back for appliance services."
          }
        >
          {search && (
            <button className="secondary" onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
        </EmptyState>
      )}
    </section>
  );
}
export function ApplianceServices() {
  const { applianceId } = useParams();
  const unlisted = homeAppliances.find(
    (appliance) => `unlisted-${appliance.key}` === applianceId,
  );
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
    enabled: !unlisted,
    staleTime: 300_000,
    refetchOnMount: "always",
  });
  if (unlisted)
    return (
      <section className="section page services-discovery">
        <Link className="text-button appliance-back" to="/services">
          All appliances
        </Link>
        <div className="page-heading">
          <h1>{unlisted.label}</h1>
        </div>
        <EmptyState title="No services listed yet">
          <p>
            There are no {unlisted.label.toLowerCase()} services in the current
            catalogue. Check back later or contact support for help.
          </p>
          <Link className="secondary" to="/support">
            Help &amp; Support
          </Link>
        </EmptyState>
      </section>
    );
  if (q.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton variant="services" />
      </section>
    );
  if (q.isError)
    return (
      <section className="section page" role="alert">
        <p>Unable to load this appliance's services.</p>
        <button onClick={() => q.refetch()}>Try again</button>
        <Link to="/services">All appliances</Link>
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
        All appliances
      </Link>
      <div className="page-heading">
        <div>
          <h1>{q.data.meta.appliance.name}</h1>
          <p>Choose a service or installation for your appliance.</p>
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
