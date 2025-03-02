import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import Calendar from "@/pages/Calendar";
import Projects from "@/pages/Projects";
import Assistant from "@/pages/Assistant";
import Weather from "@/pages/Weather";
import Header from "@/components/layout/Header";
import { useAuth } from "./contexts/AuthContext";
import { useEffect, Suspense } from "react";
import ChatInterface from "./components/assistant/ChatInterface";
import { Loader2 } from "lucide-react";

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
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Router />
          </div>
        </main>
        <ChatInterface />
      </div>
    </Suspense>
  );
}

export default App;
