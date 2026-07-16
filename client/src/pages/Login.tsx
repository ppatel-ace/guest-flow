import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { AceBrand } from "@/components/AceBrand";

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, ssoLoginUrl } = useAuth();
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
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // If SSO is configured and user isn't authenticated, redirect to SSO login page
  useEffect(() => {
    if (!authLoading && !isAuthenticated && ssoLoginUrl) {
      window.location.href = ssoLoginUrl;
    }
  }, [authLoading, isAuthenticated, ssoLoginUrl]);

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
      setLocation("/");
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
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[hsl(222_42%_8%)] p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 20% 20%, hsl(220 80% 28% / 0.45), transparent), radial-gradient(ellipse 60% 40% at 90% 80%, hsl(32 70% 35% / 0.2), transparent)",
          }}
        />
        <Card className="relative w-full max-w-md border-white/10 bg-white/5 text-white backdrop-blur-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">
              <AceBrand showProductName={false} variant="white" />
            </div>
            <div className="mx-auto w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-white/70">Redirecting to ACE sign-in…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[hsl(222_42%_8%)] p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 15% 10%, hsl(220 80% 28% / 0.5), transparent), radial-gradient(ellipse 50% 40% at 85% 90%, hsl(32 70% 35% / 0.18), transparent)",
        }}
      />
      <Card className="relative w-full max-w-md border-white/10 bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <AceBrand showProductName variant="navy" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
            <CardDescription>
              Sign in to manage invitations and visitor check-ins
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
