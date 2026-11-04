import type { AxiosInstance } from "axios";

// Keep local /api proxies working; production can use a separate API origin.
export function configureApiOrigin(client: AxiosInstance, configured?: string) {
  if (!configured) return;
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "VITE_API_ORIGIN must be an HTTP(S) origin without a path or credentials",
    );
  }
  const origin = url.origin;
  client.defaults.baseURL = origin + client.defaults.baseURL;
  // Catalogue media paths are returned relative to the API, including uploads.
  const mediaFields = new Set(["icon_url", "icon_preview_url", "previewUrl"]);
  function resolveMedia(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        mediaFields.has(key) &&
        typeof child === "string" &&
        child.startsWith("/api/")
      ) {
        (value as Record<string, unknown>)[key] = origin + child;
      } else if (child && typeof child === "object") resolveMedia(child);
    }
  }
  client.interceptors.response.use((response) => {
    resolveMedia(response.data);
    return response;
  });
}
