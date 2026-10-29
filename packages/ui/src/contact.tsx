import { FaPhone, FaCopy } from "react-icons/fa6";
import { contactPhone } from "@home/shared";
import { toast } from "sonner";
export function CustomerContact({
  name,
  phone,
  reference,
  copy = true,
}: {
  name?: string | null;
  phone?: string | null;
  reference?: string;
  copy?: boolean;
}) {
  const number = contactPhone(phone);
  return (
    <div className="customer-contact">
      <h3>Customer Contact</h3>
      <strong>{name || "Customer"}</strong>
      {reference && <small>Customer ID: {reference}</small>}
      {number ? (
        <>
          <span className="contact-number">{number}</span>
          <div className="contact-actions">
            <a href={`tel:${number}`}>
              <FaPhone aria-hidden="true" /> Call Customer
            </a>
            {copy && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(number);
                    toast.success("Phone number copied.");
                  } catch {
                    toast.error(
                      "Unable to copy. Select and copy the number above.",
                    );
                  }
                }}
              >
                <FaCopy aria-hidden="true" /> Copy Number
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="safe-help">Phone number not provided</p>
      )}
    </div>
  );
}
