import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuthUser {
  username: string;
}

interface SessionResponse {
  authenticated: boolean;
  user?: AuthUser;
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
    onSuccess: () => {
      queryClient.setQueryData(["/api/session"], { authenticated: false });
      setLocation("/login");
    },
  });

  return {
    isAuthenticated: session?.authenticated ?? false,
    user: session?.user,
    isLoading,
    logout: logoutMutation.mutate,
  };
}
