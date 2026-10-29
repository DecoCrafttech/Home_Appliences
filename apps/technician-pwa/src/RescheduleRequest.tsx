import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppInput,
  AppTextarea,
  AsyncActionButton,
  useSafeMutation,
} from "@home/ui";
import { toast } from "sonner";
import axios from "axios";
import { api } from "./api";
export function RescheduleRequest({
  id,
  version,
  date,
  timeWindow,
}: {
  id: string;
  version: number;
  date: string;
  timeWindow: string;
}) {
  const [open, setOpen] = useState(false),
    [failure, setFailure] = useState("");
  const qc = useQueryClient(),
    q = useQuery({
      queryKey: ["technician", "reschedules", id],
      queryFn: async () =>
        (
          await api.get<{
            data: {
              id: string;
              state: string;
              proposed_date: string;
              proposed_time_window: string;
              reason: string;
              decision_reason: string;
              requested_at: string;
            }[];
          }>(`/jobs/${id}/reschedules`)
        ).data.data,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });
  const mutation = useSafeMutation(async (form: FormData) => {
    await api.post(`/jobs/${id}/reschedule`, {
      version,
      date: form.get("date"),
      timeWindow: `${form.get("start")}-${form.get("end")}`,
      reason: form.get("reason") || "",
    });
    await Promise.all([
      q.refetch(),
      qc.invalidateQueries({ queryKey: ["technician", "job", id] }),
    ]);
    return true;
  });
  const pending = q.data?.find((p) => p.state === "PENDING");
  return (
    <section className="reschedule-request">
      {(open || pending) && (
        <p className="safe-help">
          Your current visit stays confirmed until operations approves the
          change.
        </p>
      )}
      {q.isError ? (
        <p role="alert">
          Unable to load schedule requests.{" "}
          <button onClick={() => q.refetch()}>Retry</button>
        </p>
      ) : pending ? (
        <p role="status">
          Awaiting approval: {pending.proposed_date.slice(0, 10)} ·{" "}
          {pending.proposed_time_window}
        </p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} disabled={q.isPending}>
          Request reschedule
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setFailure("");
            try {
              if (await mutation.run(new FormData(e.currentTarget))) {
                toast.success("Reschedule request sent to operations.");
                setOpen(false);
              }
            } catch (error) {
              const text = axios.isAxiosError(error)
                ? error.response?.data?.error?.message ||
                  "Unable to request reschedule."
                : "Unable to request reschedule.";
              setFailure(text);
              toast.error(text);
            }
          }}
        >
          <fieldset disabled={mutation.isPending}>
            <label>
              Proposed date
              <AppInput
                name="date"
                type="date"
                required
                defaultValue={date.slice(0, 10)}
              />
            </label>
            <label>
              Start time
              <AppInput
                name="start"
                type="time"
                defaultValue={timeWindow.slice(0, 5)}
                required
              />
            </label>
            <label>
              End time
              <AppInput
                name="end"
                type="time"
                defaultValue={timeWindow.slice(6)}
                required
              />
            </label>
            <label>
              Reason (optional)
              <AppTextarea name="reason" maxLength={1000} />
            </label>
          </fieldset>
          {failure && <p role="alert">{failure}</p>}
          <div className="workflow-actions">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <AsyncActionButton
              type="submit"
              pending={mutation.isPending}
              pendingLabel="Sending..."
              className="primary"
            >
              Send reschedule request
            </AsyncActionButton>
          </div>
        </form>
      )}
      {!!q.data?.filter((p) => p.state !== "PENDING").length && (
        <details>
          <summary>Previous schedule requests</summary>
          {q.data
            .filter((p) => p.state !== "PENDING")
            .map((p) => (
              <p key={p.id}>
                {p.proposed_date.slice(0, 10)} · {p.proposed_time_window} ·{" "}
                {p.state.toLowerCase()}
                {p.decision_reason ? ` · ${p.decision_reason}` : ""}
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
