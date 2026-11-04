import axios from "axios";
import { protectApi, configureApiOrigin } from "@home/ui";
export const api = axios.create({
  baseURL: "/api/v1/technician",
  withCredentials: true,
  timeout: 20000,
});
configureApiOrigin(api, import.meta.env.VITE_API_ORIGIN);
protectApi(api, "technician");
