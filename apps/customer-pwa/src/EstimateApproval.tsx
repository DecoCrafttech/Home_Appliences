import { AsyncActionButton as SafeAsyncButton } from "@home/ui";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./lib/api";
import { customerKeys } from "./lib/queryKeys";
import { LoadingSkeleton } from "./components/ui";
type Estimate = {
  id: string;
  version: number;
  state: string;
  diagnosis: string;
  items: {
    type: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
};
export function EstimateApproval({
  requestId,
  closed,
}: {
  requestId: string;
  closed: boolean;
}) {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["customer-estimates", requestId],
    queryFn: async () =>
      (
        await api.get<{ data: Estimate[] }>(
          "/requests/" + requestId + "/estimates",
        )
      ).data.data,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  if (q.isPending)
    return (
      <section className="detail-panel" aria-label="Loading estimate">
        <LoadingSkeleton variant="detail" />
      </section>
    );
  if (q.isError)
    return (
      <section className="detail-panel">
        <h2>Additional work estimate</h2>
        <p>
          Unable to load estimates.{" "}
          <button onClick={() => q.refetch()}>Retry</button>
        </p>
      </section>
    );
  if (!q.data?.length) return null;
  const e = q.data[0]!;
  async function decide(decision: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/estimates/" + e.id + "/decision", { decision });
      await Promise.all([
        qc.invalidateQueries(
          { queryKey: ["customer-estimates", requestId] },
          { cancelRefetch: false },
        ),
        qc.invalidateQueries(
          { queryKey: customerKeys.request(requestId) },
          { cancelRefetch: false },
        ),
        qc.invalidateQueries(
          { queryKey: customerKeys.requests },
          { cancelRefetch: false },
        ),
        qc.invalidateQueries(
          { queryKey: customerKeys.timeline(requestId) },
          { cancelRefetch: false },
        ),
      ]);
      toast.success(
        decision === "APPROVED"
          ? "Estimate approved. Your technician has been notified."
          : "Estimate declined. Additional work will remain on hold.",
      );
    } catch (e) {
      toast.error(
        axios.isAxiosError(e)
          ? e.response?.data?.error?.message || "Unable to connect."
          : "Unable to save your decision.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-panel">
      <h2>Additional work estimate</h2>
      <p>
        Version {e.version} · {e.state.replaceAll("_", " ")}
      </p>
      <p>{e.diagnosis}</p>
      {e.items.map((v, k) => (
        <p key={k}>
          {v.description} ({v.type}) · {v.quantity} · INR{" "}
          {v.unitPrice.toFixed(2)}
        </p>
      ))}
      <p>
        Subtotal: INR {(e.subtotal_paise / 100).toFixed(2)} · Tax: INR{" "}
        {(e.tax_paise / 100).toFixed(2)}
      </p>
      <strong>Total: INR {(e.total_paise / 100).toFixed(2)}</strong>
      {e.state === "AWAITING_CUSTOMER_APPROVAL" && !closed && (
        <>
          <p>
            Review the items before approving additional work. Declining keeps
            additional work on hold.
          </p>
          <SafeAsyncButton
            className="primary"
            disabled={busy}
            onClick={() => decide("APPROVED")}
            pending={busy}
            pendingLabel="Saving..."
          >
            Approve estimate
          </SafeAsyncButton>
          <SafeAsyncButton
            disabled={busy}
            onClick={() => decide("REJECTED")}
            pending={busy}
            pendingLabel="Declining..."
          >
            Decline estimate
          </SafeAsyncButton>
        </>
      )}
    </section>
  );
}
