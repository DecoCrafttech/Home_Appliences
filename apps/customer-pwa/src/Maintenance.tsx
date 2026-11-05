import { ServiceCard, usePublishedCatalogue } from "./PublishedServices";
import { LoadingSkeleton, EmptyState } from "./components/ui";

const categories = [
  {
    name: "Electrical",
    description: "Switches, lights & electrical repairs",
    photo: "/maintenance/electrical.webp",
    alt: "Electrician working on a wall switch",
    match: /electric|wiring|switch|lighting/i,
  },
  {
    name: "Plumbing",
    description: "Taps, leaks & bathroom fittings",
    photo: "/maintenance/plumbing.webp",
    alt: "Plumber repairing a bathroom faucet",
    match: /plumb|faucet|tap|pipe|drain|leak/i,
  },
  {
    name: "Painting",
    description: "Fresh walls & careful touch-ups",
    photo: "/maintenance/painting.webp",
    alt: "Painter applying a fresh coat to an interior wall",
    match: /paint|wall finish/i,
  },
];

export function Maintenance() {
  const query = usePublishedCatalogue();
  const rows = (query.data || []).filter(
    (service) =>
      service.category_kind === "MAINTENANCE" ||
      /home maintenance/i.test(service.appliance_name),
  );
  const groups = categories.map((category) => ({
    ...category,
    services: rows.filter((service) =>
      category.match.test(`${service.appliance_name} ${service.name}`),
    ),
  }));
  const other = rows.filter(
    (service) => !groups.some((group) => group.services.includes(service)),
  );
  return (
    <section
      className="maintenance-section"
      aria-labelledby="maintenance-heading"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">CARE BEYOND APPLIANCES</span>
          <h2 id="maintenance-heading">Home maintenance</h2>
          <p>Find the right help for the rest of your home.</p>
        </div>
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
      ) : (
        <>
          <div className="maintenance-category-grid">
            {groups.map((category) => (
              <article className="maintenance-category" key={category.name}>
                <img
                  src={category.photo}
                  alt={category.alt}
                  width={640}
                  height={480}
                  loading="lazy"
                  decoding="async"
                />
                <div className="maintenance-category-copy">
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  {category.services.length ? (
                    <div className="maintenance-service-list">
                      {category.services.map((service) => (
                        <ServiceCard service={service} key={service.id} />
                      ))}
                    </div>
                  ) : (
                    <span className="maintenance-unavailable">
                      Not available yet
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
          {other.length > 0 && (
            <div className="maintenance-other">
              <h3>More home maintenance</h3>
              <div className="discovery-grid">
                {other.map((service) => (
                  <ServiceCard service={service} key={service.id} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
