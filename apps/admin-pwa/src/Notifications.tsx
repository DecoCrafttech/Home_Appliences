import { notificationInbox } from "@home/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { adminKeys } from "./design";
type Notice = {
  id: string;
  request_id: string | null;
  related_path: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
export function useAdminNotifications() {
  const me = useQuery({
    queryKey: adminKeys.me,
    queryFn: async () => (await api.get("/auth/me")).data.data,
    staleTime: 30000,
    retry: false,
  });
  return useQuery({
    queryKey: ["admin-notifications", me.data?.id],
    queryFn: async () =>
      notificationInbox(
        (
          await api.get<{
            data: Notice[];
            meta?: { unreadCount: number; fetchedAt: string };
          }>("/notifications")
        ).data,
      ),
    enabled: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    refetchOnMount: false,
    staleTime: 60000,
  });
}
