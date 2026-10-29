import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { activeRecordRefresh, retryTransientRequest } from "./queryPolicy";

afterEach(() => vi.unstubAllGlobals());
describe("request refresh policies", () => {
  it.each([401, 403, 404, 422])(
    "does not retry permanent HTTP %i errors",
    (status) => {
      const error = new AxiosError("denied");
      error.response = { status } as NonNullable<AxiosError["response"]>;
      expect(retryTransientRequest(0, error)).toBe(false);
    },
  );
  it("retries transient connection failures at most once", () => {
    expect(retryTransientRequest(0, new Error("offline"))).toBe(true);
    expect(retryTransientRequest(1, new Error("offline"))).toBe(false);
  });
  it("monitors only visible active records with successful data", () => {
    vi.stubGlobal("document", { visibilityState: "visible" });
    expect(
      activeRecordRefresh({ state: { data: { status: "IN_PROGRESS" } } }),
    ).toBe(30000);
    expect(
      activeRecordRefresh({ state: { data: { status: "COMPLETED" } } }),
    ).toBe(false);
    expect(
      activeRecordRefresh({
        state: { data: { status: "IN_PROGRESS" }, error: new Error("failed") },
      }),
    ).toBe(false);
    expect(activeRecordRefresh({ state: {} })).toBe(false);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    expect(
      activeRecordRefresh({ state: { data: { status: "IN_PROGRESS" } } }),
    ).toBe(false);
  });
});
