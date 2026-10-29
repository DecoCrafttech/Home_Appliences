import { AppRadio } from "@home/ui";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
import { adminKeys } from "./design";
import {
  CustomerAvatar,
  LoadingSkeleton,
  ErrorState,
  SearchField,
} from "./components";

export type AssignmentRequest = {
  id: string;
  version: number;
  request_number: string;
  customer_name: string;
  appliance: string;
  status?: string;
  request_type?: string;
  preferred_date?: string;
  preferred_time_window?: string;
  confirmed_date?: string;
  confirmed_time_window?: string;
  address_snapshot?: Record<string, string>;
};
type TechnicianOption = {
  id: string;
  full_name: string;
  service_area: string;
  verification_status?: string;
  account_status: string | null;
  scheduled_workload: number;
  average_rating: number | null;
};
export function AssignTechnicianDrawer({
  request,
  onClose,
}: {
  request: AssignmentRequest;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(""),
    [failure, setFailure] = useState("");
  const { register, watch, handleSubmit, setValue, getValues } = useForm<{
    technicianId: string;
  }>({
    resolver: zodResolver(z.object({ technicianId: z.string().uuid() })),
    defaultValues: { technicianId: "" },
  });
  const selected = watch("technicianId");
  // A retry after an unknown network outcome must retain its original version/key.
  const operationVersion = useRef(request.version);
  const reviewPrepared = useRef(request.status !== "REQUESTED");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "technicians-for-assignment", request.id],
    queryFn: async () =>
      (
        await api.get<{
          data: TechnicianOption[];
        }>(`/requests/${request.id}/eligible-technicians`)
      ).data,
    refetchOnMount: "always",
  });
  const mutation = useSafeMutation(async (technicianId: string) => {
    if (!reviewPrepared.current) {
      const reviewed = await api.post(`/requests/${request.id}/status`, {
        status: "UNDER_REVIEW",
        version: request.version,
        note: "Reviewed for technician assignment",
      });
      operationVersion.current = reviewed.data.data.version;
      reviewPrepared.current = true;
    }
    const response = await api.post(`/requests/${request.id}/offer`, {
      technicianId,
      version: operationVersion.current,
      reason: "Assigned by operations",
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: adminKeys.requests }),
      qc.invalidateQueries({ queryKey: adminKeys.request(request.id) }),
      qc.invalidateQueries({ queryKey: adminKeys.summary }),
      qc.invalidateQueries({ queryKey: adminKeys.dashboardActivity }),
      qc.invalidateQueries({ queryKey: ["admin", "technician-workflow"] }),
    ]);
    return response.data.alreadyProcessed ? "processed" : "assigned";
  });
  async function submit() {
    const technicianId = getValues("technicianId");
    if (
      !technicianId ||
      q.isFetching ||
      q.isError ||
      !matches.some((t) => t.id === technicianId)
    )
      return;
    setFailure("");
    try {
      const result = await mutation.run(technicianId);
      if (result && mutation.isMounted()) {
        toast.success(
          result === "processed"
            ? "This action has already been processed."
            : "Technician assigned successfully.",
        );
        onClose();
      }
    } catch (e) {
      if (request.status === "REQUESTED" && reviewPrepared.current) {
        void qc.invalidateQueries({ queryKey: adminKeys.requests });
        void qc.invalidateQueries({ queryKey: adminKeys.request(request.id) });
      }
      if (mutation.isMounted())
        setFailure(
          axios.isAxiosError(e)
            ? e.response?.data?.error?.message ||
                "Unable to connect. Please try again."
            : "Unable to assign technician.",
        );
    }
  }
  const matchesSearch = (technician: TechnicianOption, value: string) =>
    `${technician.full_name} ${technician.id} ${technician.service_area}`
      .toLowerCase()
      .includes(value.trim().toLowerCase());
  const matches = q.data?.data.filter((t) => matchesSearch(t, search)) || [];
  const submitForm = handleSubmit(submit);
  function changeSearch(value: string) {
    setSearch(value);
    // Never submit an earlier selection that has disappeared from the visible results.
    if (
      selected &&
      !q.data?.data.some((t) => t.id === selected && matchesSearch(t, value))
    ) {
      setValue("technicianId", "");
    }
  }
  return (
    <ConfirmActionDialog
      title="Assign Technician"
      onClose={onClose}
      pending={mutation.isPending}
      drawer
    >
      <form onSubmit={submitForm}>
        <div className="assignment-summary" aria-label="Request summary">
          <div>
            <span>Request</span>
            <strong>{request.request_number}</strong>
          </div>
          <div>
            <span>Customer</span>
            <strong>{request.customer_name}</strong>
          </div>
          <div>
            <span>Service</span>
            <strong>
              {request.appliance} ·{" "}
              {request.request_type === "INSTALLATION"
                ? "Installation"
                : "Service"}
            </strong>
          </div>
          <div>
            <span>Preferred visit</span>
            <strong>
              {request.preferred_date || "Date not set"}
              {request.preferred_time_window &&
                ` · ${request.preferred_time_window}`}
            </strong>
          </div>
          <div>
            <span>Area</span>
            <strong>
              {[request.address_snapshot?.area, request.address_snapshot?.city]
                .filter(Boolean)
                .join(", ") || "Not provided"}
            </strong>
          </div>
        </div>
        <label>
          Search technicians
          <SearchField
            aria-label="Search technicians"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            onClear={() => changeSearch("")}
            placeholder="Name, Technician ID or service area"
            disabled={mutation.isPending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitForm();
              }
            }}
          />
        </label>
        {q.isPending ? (
          <LoadingSkeleton title="Loading technicians..." variant="list" />
        ) : q.isError ? (
          <ErrorState
            title="Unable to load technicians"
            retry={() => q.refetch()}
          />
        ) : (
          <>
            <p className="assignment-results" role="status">
              {matches.length}{" "}
              {matches.length === 1 ? "technician" : "technicians"}
            </p>
            {!matches.length && (
              <div className="assignment-empty">
                <p role="status">
                  {search.trim()
                    ? "No technicians match this search."
                    : "No technicians have been added yet."}
                </p>
                {!!search.trim() && (
                  <button type="button" onClick={() => changeSearch("")}>
                    Clear search
                  </button>
                )}
              </div>
            )}
            {matches.map((t) => (
              <label className="eligible-card" key={t.id}>
                <AppRadio
                  {...register("technicianId")}
                  value={t.id}
                  disabled={
                    mutation.isPending || t.account_status === "SUSPENDED"
                  }
                  required
                />
                <CustomerAvatar name={t.full_name} />
                <span>
                  <strong>{t.full_name}</strong>
                  <small>
                    {t.service_area || "Service area not specified"}
                    {t.verification_status &&
                      ` · ${t.verification_status.replaceAll("_", " ").toLowerCase()}`}
                  </small>
                  <small>
                    {t.account_status === "SUSPENDED"
                      ? "Account frozen · contact an administrator to unfreeze"
                      : `${t.scheduled_workload} scheduled open jobs`}
                  </small>
                  {t.average_rating !== null && (
                    <small>Customer rating: {t.average_rating}/5</small>
                  )}
                </span>
              </label>
            ))}
          </>
        )}
        {failure && (
          <p role="alert" className="safe-error">
            {failure}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <AsyncActionButton
            className="primary"
            type="submit"
            pending={mutation.isPending}
            pendingLabel="Assigning..."
            disabled={
              q.isFetching ||
              q.isError ||
              !matches.some((t) => t.id === selected)
            }
          >
            Confirm Assignment
          </AsyncActionButton>
        </footer>
      </form>
    </ConfirmActionDialog>
  );
}
