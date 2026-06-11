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
}

export function useAuth() {
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useQuery<SessionResponse>({
    queryKey: ["/api/session"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/logout");
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(["/api/session"], { authenticated: false });
      // If the server returns an SSO logout URL, follow it
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
    isLoading,
    logout: logoutMutation.mutate,
  };
}
