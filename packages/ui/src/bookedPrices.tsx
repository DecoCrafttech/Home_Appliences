import { indicativePrice, type CatalogueOption } from "@home/shared";
export function BookedPriceSummary({
  details,
}: {
  details?: Record<string, unknown>;
}) {
  const rows = (
    Array.isArray(details?._priceSnapshots)
      ? details._priceSnapshots
      : details?._priceSnapshot
        ? [details._priceSnapshot]
        : []
  ) as CatalogueOption[];
  if (!rows.length) return null;
  return (
    <section className="booked-price">
      <h3>Booked indicative price</h3>
      {rows.map((row, i) => (
        <div key={row.id || i}>
          <p>{row.name}</p>
          <strong>{indicativePrice(row)}</strong>
          {row.included && <p>Included: {row.included}</p>}
          {row.exclusions && <p>Extra charges: {row.exclusions}</p>}
        </div>
      ))}
      <small>
        Prices recorded at booking. Final charges may depend on inspection or
        approved additional work.
      </small>
    </section>
  );
}
