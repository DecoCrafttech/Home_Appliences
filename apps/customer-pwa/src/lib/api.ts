import axios from "axios";
import { protectApi, configureApiOrigin } from "@home/ui";
export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 30000,
});
configureApiOrigin(api, import.meta.env.VITE_API_ORIGIN);
protectApi(api, "customer");
export function catalogueImageUrl(src?: string | null) {
  if (!src) return "";
  if (!src.startsWith("/api/")) return src;
  return new URL(
    src,
    new URL(api.defaults.baseURL || "/", window.location.origin),
  ).href;
}
