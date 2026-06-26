import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuthUser {
  email?: string;
  name?: string;
  username?: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: AuthUser;
  ssoLoginUrl?: string;
  staleAccess?: boolean;
  accessDenied?: boolean;
  message?: string;
}

export function useAuth() {
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useQuery<SessionResponse>({
    queryKey: ["/api/session"],
    queryFn: async () => {
      const res = await fetch("/api/session", { credentials: "include" });
      const data = (await res.json()) as SessionResponse;
      if (res.status === 403) {
        return {
          authenticated: false,
          accessDenied: data.error === "NO_ACCESS" && !data.staleAccess,
          staleAccess: data.staleAccess === true,
          message: data.message || "Access denied",
          ssoLoginUrl: data.ssoLoginUrl,
        };
      }
      if (!res.ok) {
        throw new Error(`${res.status}: ${data.message || res.statusText}`);
      }
      return data;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      return res.json() as Promise<{ success: boolean; ssoLogoutUrl?: string }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/session"], { authenticated: false });
      // If the server returns an SSO logout URL, follow it (clears cookie domain-wide)
      if (data?.ssoLogoutUrl) {
        window.location.href = data.ssoLogoutUrl;
      } else {
        setLocation("/ace-admin");
      }
    },
  });

  return {
    isAuthenticated: session?.authenticated ?? false,
    user: session?.user,
    ssoLoginUrl: session?.ssoLoginUrl,
    staleAccess: session?.staleAccess ?? false,
    accessDenied: session?.accessDenied ?? false,
    sessionMessage: session?.message,
    isLoading,
    logout: logoutMutation.mutate,
  };
}
