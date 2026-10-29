import axios from "axios";
import { protectApi } from "@home/ui";
export const api = axios.create({
  baseURL: "/api/v1/technician",
  withCredentials: true,
  timeout: 20000,
});
protectApi(api, "technician");
