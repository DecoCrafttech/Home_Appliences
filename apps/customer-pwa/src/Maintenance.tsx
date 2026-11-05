import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa6";
import { ImageWithFallback } from "@home/ui";
import {
  usePublishedCatalogue,
  type PublishedService,
} from "./PublishedServices";
import { LoadingSkeleton, EmptyState } from "./components/ui";

const categories = [
  {
    name: "Electrical",
    photo: "/maintenance/electrical-cutout.webp",
    match: /electric|wiring|switch|lighting/i,
  },
  {
    name: "Plumbing",
    photo: "/maintenance/plumbing-cutout.webp",
    match: /plumb|faucet|tap|pipe|drain|leak/i,
  },
  {
    name: "Painting",
    photo: "/maintenance/painting-cutout.webp",
    match: /paint|wall finish/i,
  },
];

export function Maintenance() {
  const query = usePublishedCatalogue();
  const services = (query.data || []).filter(
    (service) =>
      service.category_kind === "MAINTENANCE" ||
      /home maintenance/i.test(service.appliance_name),
  );
  const cards = categories.flatMap<{
    name: string;
    photo: string;
    service: PublishedService | null;
  }>((category) => {
    const matches = services.filter((service) =>
      category.match.test(service.appliance_name + " " + service.name),
    );
    return matches.length
      ? matches.map((service) => ({
          name: service.name,
          photo: category.photo,
          service,
        }))
      : [{ name: category.name, photo: category.photo, service: null }];
  });
  for (const service of services) {
    if (!cards.some((card) => card.service?.id === service.id))
      cards.push({
        name: service.name,
        photo: "/categories/v8/maintenance.webp",
        service,
      });
  }
  return (
    <section
      className="maintenance-section services-discovery"
      aria-labelledby="maintenance-heading"
    >
      <div className="section-heading">
        <h2 id="maintenance-heading">Home maintenance</h2>
      </div>
      {query.isPending ? (
        <LoadingSkeleton variant="appliances" count={3} />
      ) : query.isError ? (
        <EmptyState
          kind="network"
          title="Unable to load maintenance"
          description="Check your connection and try again."
          primaryAction={
            <button className="primary" onClick={() => query.refetch()}>
              Try again
            </button>
          }
        />
      ) : (
        <div className="appliance-grid maintenance-grid">
          {cards.map(({ name, photo, service }) => {
            const content = (
              <>
                <div className="appliance-photo-wrap">
                  <ImageWithFallback
                    className="appliance-photo"
                    src={photo}
                    alt=""
                    width={640}
                    height={480}
                    loading="lazy"
                    decoding="async"
                    fallback={
                      <span className="appliance-photo-missing">
                        Photo unavailable
                      </span>
                    }
                  />
                </div>
                <div className="appliance-card-footer">
                  <h3>{name}</h3>
                  {service && <FaChevronRight aria-hidden="true" />}
                </div>
              </>
            );
            if (!service)
              return (
                <div
                  className="appliance-card maintenance-card"
                  key={name}
                  aria-label={name + ": not available yet"}
                  aria-disabled="true"
                >
                  {content}
                </div>
              );
            const params = new URLSearchParams({
              applianceCategoryId: service.appliance_category_id,
              serviceId: service.id,
            });
            return (
              <Link
                className="appliance-card maintenance-card"
                key={service.id}
                to={
                  "/request/" +
                  (service.request_type === "INSTALLATION"
                    ? "installation"
                    : "service") +
                  "?" +
                  params
                }
                aria-label={"Book " + service.name}
              >
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
