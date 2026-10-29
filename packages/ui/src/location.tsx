import { toast } from "sonner";
import {
  FaMapLocationDot,
  FaCopy,
  FaShareNodes,
  FaRoute,
} from "react-icons/fa6";

export function serviceLocation(address: Record<string, unknown>) {
  const text = [
    address.line1,
    address.area,
    address.city,
    address.state,
    address.pinCode || address.pin_code,
  ]
    .filter(Boolean)
    .join(", ");
  const lat = Number(address.latitude),
    lng = Number(address.longitude);
  const coordinates =
    address.latitude != null &&
    address.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  const destination = coordinates ? `${lat},${lng}` : text;
  return {
    text,
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
  };
}
export function LocationActions({
  address,
  directions = false,
  compact = false,
}: {
  address?: Record<string, unknown>;
  directions?: boolean;
  compact?: boolean;
}) {
  if (!address) return null;
  const location = serviceLocation(address);
  if (!location.text && !address.latitude) return null;
  if (compact)
    return (
      <div className="location-actions">
        <a
          href={directions ? location.directions : location.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <FaRoute aria-hidden="true" />{" "}
          {directions ? "Get Directions" : "View Location"}
        </a>
      </div>
    );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Unable to copy. Open the location to copy it manually.");
    }
  }
  return (
    <div className="location-actions">
      <a href={location.url} target="_blank" rel="noopener noreferrer">
        <FaMapLocationDot /> View Location
      </a>
      {directions && (
        <a href={location.directions} target="_blank" rel="noopener noreferrer">
          Get Directions
        </a>
      )}
      <button type="button" onClick={() => copy(location.text)}>
        <FaCopy /> Copy address
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!navigator.share) return copy(location.url);
          try {
            await navigator.share({
              title: "Service location",
              text: location.text,
              url: location.url,
            });
          } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError"))
              await copy(location.url);
          }
        }}
      >
        <FaShareNodes /> Share Location
      </button>
    </div>
  );
}
