import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, accessDenied, ssoLoginUrl } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (accessDenied) {
    return <Redirect to="/access-denied" />;
  }

  if (!isAuthenticated) {
    if (ssoLoginUrl) {
      window.location.href = ssoLoginUrl;
      return null;
    }
    return <Redirect to="/ace-admin" />;
  }

  return <>{children}</>;
}
