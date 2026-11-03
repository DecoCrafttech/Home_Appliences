import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "@home/ui";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import { ServiceCard, usePublishedCatalogue } from "./PublishedServices";
import { EmptyState, LoadingSkeleton } from "./components/ui";

export function CatalogueSearch() {
  const [open, setOpen] = useState(true);
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const term = useDebouncedValue(search.trim(), 200);
  const services = usePublishedCatalogue(term.length >= 2);
  function update(value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true, preventScrollReset: true });
  }
  const matches = (services.data || []).filter((service) =>
    `${service.name} ${service.appliance_name} ${service.description || ""}`
      .toLowerCase()
      .includes(term.toLowerCase()),
  );
  return (
    <section
      className="v6-home-search"
      aria-label="Find appliance care"
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <label className="discovery-search">
        <FaMagnifyingGlass aria-hidden="true" />
        <input
          type="search"
          aria-label="Search appliances and services"
          placeholder="Search appliances, services or issues…"
          value={search}
          onChange={(e) => {
            setOpen(true);
            update(e.target.value);
          }}
        />
        {search && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={() => update("")}
          >
            <FaXmark aria-hidden="true" />
          </button>
        )}
      </label>
      {open && term.length >= 2 && (
        <div className="v6-search-results" aria-live="polite">
          <h2>Matching services</h2>
          {services.isPending ? (
            <LoadingSkeleton variant="services" count={2} />
          ) : services.isError ? (
            <EmptyState
              kind="network"
              title="Unable to search services"
              description="Check your connection and try again."
              primaryAction={
                <button
                  className="secondary"
                  onClick={() => services.refetch()}
                >
                  Retry
                </button>
              }
            />
          ) : matches.length ? (
            <div className="discovery-grid">
              {matches.map((service) => (
                <ServiceCard service={service} key={service.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              kind="search"
              title="No matching services"
              description="Try an appliance or a different service name."
              primaryAction={
                <button className="secondary" onClick={() => update("")}>
                  Clear Search
                </button>
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
