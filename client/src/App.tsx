import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CheckIn from "@/pages/CheckIn";
import Invitations from "@/pages/Invitations";
import Import from "@/pages/Import";
import StandaloneCheckIn from "@/pages/StandaloneCheckIn";
import GuestCheckIn from "@/pages/GuestCheckIn";
import NotFound from "@/pages/not-found";

function MainRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/check-in" component={CheckIn} />
      <Route path="/invitations" component={Invitations} />
      <Route path="/import" component={Import} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const normalizedLocation = location.toLowerCase();
  
  // Login page (public)
  if (normalizedLocation === "/login") {
    return <Login />;
  }

  // Standalone check-in page without sidebar (public)
  if (normalizedLocation === "/scan") {
    return <StandaloneCheckIn />;
  }

  // Guest check-in form without sidebar (public)
  if (normalizedLocation === "/guest-check-in") {
    return <GuestCheckIn />;
  }

  // Main app with sidebar (protected)
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ProtectedRoute>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <HeaderWithLogout />
            <main className="flex-1 overflow-auto p-6">
              <MainRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

function HeaderWithLogout() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          data-testid="button-logout-header"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
