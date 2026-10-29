import axios from "axios";
import { protectApi } from "@home/ui";
export const api = axios.create({
  baseURL: "/api/v1/admin",
  withCredentials: true,
  timeout: 30000,
});
protectApi(api, "admin");
