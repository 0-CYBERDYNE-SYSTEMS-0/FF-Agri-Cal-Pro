import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import { CalendarProvider } from "./contexts/CalendarContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <CalendarProvider>
      <App />
    </CalendarProvider>
  </AuthProvider>
);
