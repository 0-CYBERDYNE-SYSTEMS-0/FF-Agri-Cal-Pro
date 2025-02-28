import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Calendar from "@/pages/Calendar";
import Projects from "@/pages/Projects";
import Assistant from "@/pages/Assistant";
import Weather from "@/pages/Weather";
import Header from "@/components/layout/Header";
import { useAuth } from "./contexts/AuthContext";
import { useEffect } from "react";
import ChatInterface from "./components/assistant/ChatInterface";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Calendar} />
      <Route path="/projects" component={Projects} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/weather" component={Weather} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { login, user } = useAuth();

  useEffect(() => {
    // Auto-login with demo user for simplicity
    if (!user) {
      login("demo", "password123");
    }
  }, [login, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Router />
          </div>
        </main>
        <ChatInterface />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
