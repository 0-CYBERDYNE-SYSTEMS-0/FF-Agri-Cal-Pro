import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { CalendarProvider } from "./contexts/CalendarContext";
import { LocationProvider } from "./contexts/LocationContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LocationProvider>
          <CalendarProvider>
            <App />
          </CalendarProvider>
        </LocationProvider>
      </AuthProvider>
    </TooltipProvider>
    <Toaster />
  </QueryClientProvider>
);
