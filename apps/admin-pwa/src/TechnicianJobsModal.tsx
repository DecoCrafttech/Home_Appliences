import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ConfirmActionDialog } from "@home/ui";
import { requestReference } from "@home/shared";
import { api } from "./api";
import { LoadingSkeleton, ErrorState, StatusBadge } from "./components";
export function TechnicianJobsModal({
  technician,
  onClose,
}: {
  technician: { id: string; full_name: string };
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["admin-technician-jobs", technician.id, page],
    queryFn: async () =>
      (
        await api.get<{
          data: {
            id: string;
            request_number: string;
            appliance: string;
            service_name: string;
            customer_name: string;
            status: string;
          }[];
          meta: { total: number };
        }>("/requests", {
          params: { technicianId: technician.id, page, limit: 20 },
        })
      ).data,
  });
  return (
    <ConfirmActionDialog
      title={`${technician.full_name} - Assigned jobs`}
      onClose={onClose}
    >
      <div className="assigned-jobs-modal">
        {q.isPending ? (
          <LoadingSkeleton />
        ) : q.isError ? (
          <ErrorState
            title="Unable to load assigned jobs"
            retry={() => q.refetch()}
          />
        ) : q.data.data.length ? (
          <>
            <div className="assigned-job-list">
              {q.data.data.map((job) => (
                <article key={job.id}>
                  <small>{requestReference(job)}</small>
                  <h3>{job.appliance}</h3>
                  <p>{job.service_name}</p>
                  <p>{job.customer_name}</p>
                  <StatusBadge status={job.status} />
                  <Link className="secondary" to={`/requests/${job.id}`}>
                    View request
                  </Link>
                </article>
              ))}
            </div>
            {q.data.meta.total > 20 && (
              <nav className="ui-actions">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  disabled={page * 20 >= q.data.meta.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        ) : (
          <p>No assigned jobs.</p>
        )}
      </div>
    </ConfirmActionDialog>
  );
}
