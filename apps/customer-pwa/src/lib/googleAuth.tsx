import { useState, createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { api } from "./api";

export function useGoogleConfiguration() {
  return useQuery({
    queryKey: ["google-configuration"],
    queryFn: async () =>
      (
        await api.get<{ data: { clientId: string | null } }>(
          "/auth/customer/config",
        )
      ).data.data,
    staleTime: 300_000,
    retry: 1,
  });
}
const GoogleScriptContext = createContext({ failed: false });
export const useGoogleScriptStatus = () => useContext(GoogleScriptContext);
export function CustomerGoogleProvider({ children }: { children: ReactNode }) {
  const config = useGoogleConfiguration();
  const [failed, setFailed] = useState(false);
  return (
    <GoogleScriptContext.Provider value={{ failed }}>
      <GoogleOAuthProvider
        clientId={config.data?.clientId || ""}
        onScriptLoadSuccess={() => setFailed(false)}
        onScriptLoadError={() => setFailed(true)}
      >
        {children}
      </GoogleOAuthProvider>
    </GoogleScriptContext.Provider>
  );
}

export function loginDestination(value: string | null): string {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/^\/(?:login)(?:[/?#]|$)/.test(value)
    ? value
    : "/";
}
