import { ImageWithFallback, useDebouncedValue } from "@home/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowRight,
  FaXmark,
  FaScrewdriverWrench,
  FaMagnifyingGlass,
  FaSnowflake,
  FaTv,
  FaDroplet,
  FaWind,
  FaFireBurner,
  FaJugDetergent,
  FaTemperatureHalf,
} from "react-icons/fa6";
import { indicativePrice, type CatalogueOption } from "@home/shared";
import { api } from "./lib/api";
import { LoadingSkeleton, EmptyState } from "./components/ui";
export type PublishedService = {
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
      (await api.get<{ data: PublishedService[] }>("/catalogue", { signal }))
        .data.data,
    enabled,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 300_000,
  });
}
function ApplianceIcon({ name }: { name: string }) {
  const value = name.toLowerCase();
  const Icon = /air conditioner|\bac\b/.test(value)
    ? FaSnowflake
    : /washing|laundry/.test(value)
      ? FaJugDetergent
      : /refrigerator|fridge|freezer/.test(value)
        ? FaTemperatureHalf
        : /television|\btv\b/.test(value)
          ? FaTv
          : /purifier|water/.test(value)
            ? FaDroplet
            : /chimney|fan/.test(value)
              ? FaWind
              : /microwave|geyser|oven/.test(value)
                ? FaFireBurner
                : FaScrewdriverWrench;
  return <Icon aria-hidden="true" />;
}
export function ServiceCard({ service }: { service: PublishedService }) {
  const option = service.booking_options?.find((o) => o.active);
  const bookingParams = new URLSearchParams({
    applianceCategoryId: service.appliance_category_id,
    serviceId: service.id,
  });
  const bookingType = service.request_type === "INSTALLATION" ? "installation" : "service";
  return (
    <Link
      className="discovery-card"
      to={`/request/${bookingType}?${bookingParams}`}
      aria-label={`Book ${service.name}`}
    >
      <div className="discovery-visual">
        <div className="discovery-icon">
          {service.icon_url ? (
            <ImageWithFallback
              src={service.icon_url}
              alt=""
              loading="lazy"
              fallback={<ApplianceIcon name={service.appliance_name} />}
            />
          ) : (
            <ApplianceIcon name={service.appliance_name} />
          )}
        </div>
        <small className="discovery-type">
          {service.request_type === "SERVICE" ? "Service" : "Installation"}
        </small>
      </div>
      <div className="discovery-content">
        <h3>{service.name}</h3>
        {service.description && (
          <p className="discovery-description">{service.description}</p>
        )}
      </div>
      <div className="discovery-footer">
        <p className="discovery-price">
          {option
            ? indicativePrice(option)
            : service.base_price != null
              ? `From ₹${Number(service.base_price).toLocaleString("en-IN")}`
              : "Quote after inspection"}
        </p>
        <span className="discovery-book">Book now <FaArrowRight aria-hidden="true" /></span>
      </div>
    </Link>
  );
}
type PublishedAppliance = {
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
  const serviceSearch = usePublishedCatalogue(settledSearch.length >= 2);
  const q = useQuery({
    queryKey: ["published-appliances"],
    queryFn: async () =>
      (await api.get<{ data: PublishedAppliance[] }>("/catalogue/appliances"))
        .data.data,
    staleTime: 300_000,
    refetchOnMount: "always",
  });
  const rows = (q.data || []).filter((a) =>
    a.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const serviceResults =
    settledSearch.length < 2
      ? []
      : (serviceSearch.data || []).filter((s) =>
          `${s.name} ${s.appliance_name} ${s.description || ""}`
            .toLowerCase()
            .includes(settledSearch.toLowerCase()),
        );
  return (
    <section
      className={compact ? "home-discovery" : "section page services-discovery"}
    >
      <div className="section-heading">
        {compact ? <h2>Choose your appliance</h2> : <h1>Appliances</h1>}
        {compact && (
          <Link to="/services">
            View all <FaArrowRight />
          </Link>
        )}
      </div>
      {
        <label className="discovery-search">
          <FaMagnifyingGlass />
          <input
            type="search"
            aria-label="Search appliances"
            placeholder={
              compact
                ? "Which appliance needs help?"
                : "Search appliances or services"
            }
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
      }
      {q.isPending ? (
        <LoadingSkeleton variant="appliances" count={compact ? 8 : 6} />
      ) : q.isError ? (
        <div role="alert">
          <p>Unable to load appliances.</p>
          <button onClick={() => q.refetch()}>Try again</button>
        </div>
      ) : !rows.length && settledSearch.length < 2 ? (
        <EmptyState
          title={
            search ? "No matching appliances" : "No appliances available yet"
          }
        />
      ) : rows.length ? (
        <div className="appliance-grid">
          {(compact && !search ? rows.slice(0, 8) : rows).map((a) => (
            <Link
              className="appliance-card"
              key={a.id}
              to={`/services/appliances/${a.id}`}
            >
              <div className="discovery-icon">
                {a.icon_url ? (
                  <ImageWithFallback
                    src={a.icon_url}
                    alt=""
                    loading="lazy"
                    fallback={<ApplianceIcon name={a.name} />}
                  />
                ) : (
                  <ApplianceIcon name={a.name} />
                )}
              </div>
              <h2>{a.name}</h2>
              <p className="appliance-card-meta">
                {a.service_count
                  ? `${a.service_count} available ${a.service_count === 1 ? "service" : "services"}`
                  : "Explore availability"}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
      {settledSearch.length >= 2 &&
        (serviceSearch.isPending ||
          serviceSearch.isError ||
          serviceResults.length > 0 ||
          rows.length === 0) && (
          <div className="service-search-results" aria-live="polite">
            <h2>Matching services</h2>
            {serviceSearch.isPending ? (
              <LoadingSkeleton />
            ) : serviceSearch.isError ? (
              <div role="alert">
                <p>Unable to search services.</p>
                <button onClick={() => serviceSearch.refetch()}>
                  Try again
                </button>
              </div>
            ) : serviceResults.length ? (
              <div className="discovery-grid">
                {serviceResults.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            ) : (
              <EmptyState title="No matching results">
                <p className="muted">Try another appliance or service name.</p>
              </EmptyState>
            )}
          </div>
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
    refetchOnMount: "always",
  });
  if (q.isPending)
    return (
      <section className="section page">
        <LoadingSkeleton variant="cards" />
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
      <h1>{q.data.meta.appliance.name}</h1>
      <p className="discovery-intro">
        Choose a service or installation for your appliance.
      </p>
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
          title={
            search || type ? "No matching services" : "No services available"
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
