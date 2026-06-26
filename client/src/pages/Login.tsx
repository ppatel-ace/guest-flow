import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, ExternalLink } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, ssoLoginUrl, staleAccess, sessionMessage } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Refetch session on mount so stale cache never blocks the redirect
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/session"] });
  }, []);

  // Redirect once we know the user is already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // SSO is the primary login path — redirect when configured
  useEffect(() => {
    if (!authLoading && !isAuthenticated && ssoLoginUrl) {
      window.location.href = ssoLoginUrl;
    }
  }, [authLoading, isAuthenticated, ssoLoginUrl]);

  const handleSsoSignIn = () => {
    if (ssoLoginUrl) {
      window.location.href = ssoLoginUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();

      // If the server returned an SSO redirect URL, follow it
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      // Update session cache directly with authenticated state
      queryClient.setQueryData(["/api/session"], {
        authenticated: true,
        user: data.user,
      });

      toast({
        title: "Success",
        description: "You have been logged in successfully",
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show a brief loading state while redirecting to SSO
  if (!authLoading && !isAuthenticated && ssoLoginUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              {staleAccess
                ? "Refreshing your ACE sign-in for GuestFlow…"
                : "Redirecting to ACE sign-in…"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            {staleAccess
              ? sessionMessage || "Sign in with your ACE account to access GuestFlow."
              : "Sign in with your ACE account to access the customer management system"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ssoLoginUrl && (
            <Button className="w-full" onClick={handleSsoSignIn} data-testid="button-sso-login">
              <ExternalLink className="h-4 w-4 mr-2" />
              Sign in with ACE SSO
            </Button>
          )}

          {!ssoLoginUrl && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
