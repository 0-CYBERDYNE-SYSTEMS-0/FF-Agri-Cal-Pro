import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const login = useCallback(async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/auth/login", { username, password });
      const userData = await response.json();
      setUser(userData);
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.displayName}!`,
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: "Invalid username or password.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
  }, [toast]);

  const contextValue = { user, isLoading, login, logout };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
