import { FaBolt, FaFaucetDrip, FaPaintRoller } from "react-icons/fa6";
import { ServiceCard, usePublishedCatalogue } from "./PublishedServices";
import { LoadingSkeleton, EmptyState } from "./components/ui";

export function Maintenance({ compact = false }: { compact?: boolean }) {
  const query = usePublishedCatalogue();
  const rows = (query.data || []).filter(
    (service) =>
      service.category_kind === "MAINTENANCE" ||
      /home maintenance/i.test(service.appliance_name),
  );
  return (
    <section className="maintenance-section">
      <div className="section-heading">
        <h2>Home Maintenance</h2>
      </div>
      {query.isPending ? (
        <LoadingSkeleton variant="services" count={3} />
      ) : query.isError ? (
        <EmptyState
          title="Unable to load maintenance"
          primaryAction={
            <button className="secondary" onClick={() => query.refetch()}>
              Retry
            </button>
          }
        />
      ) : rows.length ? (
        <div className="discovery-grid">
          {(compact ? rows.slice(0, 3) : rows).map((service) => (
            <ServiceCard service={service} key={service.id} />
          ))}
        </div>
      ) : (
        <div className="maintenance-coming">
          {[
            ["Plumbing", FaFaucetDrip],
            ["Electrical", FaBolt],
            ["Painting", FaPaintRoller],
          ].map(([label, Icon]) => (
            <div key={String(label)}>
              {typeof Icon !== "string" && Icon && <Icon aria-hidden="true" />}
              <strong>{String(label)}</strong>
              <small>Not available yet</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
