import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { customerKeys } from "./queryKeys";
import type { Customer } from "./types";

export function useCustomerProfile() {
  return useQuery({
    queryKey: customerKeys.profile,
    queryFn: async () =>
      (await api.get<{ data: Customer }>("/profile")).data.data,
    staleTime: 300_000,
    retry: false,
  });
}
