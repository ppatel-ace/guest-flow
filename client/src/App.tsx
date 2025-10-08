import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import CheckIn from "@/pages/CheckIn";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen w-full flex-col">
          <header className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-semibold">Customer Check-In</h1>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <CheckIn />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
