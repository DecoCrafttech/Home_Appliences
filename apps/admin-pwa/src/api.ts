import axios from "axios";
import { protectApi, configureApiOrigin } from "@home/ui";
export const api = axios.create({
  baseURL: "/api/v1/admin",
  withCredentials: true,
  timeout: 30000,
});
configureApiOrigin(api, import.meta.env.VITE_API_ORIGIN);
protectApi(api, "admin");
