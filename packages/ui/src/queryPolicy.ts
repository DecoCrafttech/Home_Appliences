import axios from "axios";

/** Retry one transient failure; authentication/validation errors need user action. */
export function retryTransientRequest(failureCount: number, error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (
    status &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  )
    return false;
  return failureCount < 1;
}

/** Only the open, visible, active record needs periodic cross-role monitoring. */
export function activeRecordRefresh(query: {
  state: { data?: { status?: string }; error?: unknown };
}): number | false {
  if (
    document.visibilityState !== "visible" ||
    query.state.error ||
    !query.state.data
  )
    return false;
  return ["COMPLETED", "CANCELLED"].includes(query.state.data.status || "")
    ? false
    : 30_000;
}
