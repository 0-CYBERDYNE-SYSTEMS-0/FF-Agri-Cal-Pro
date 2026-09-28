import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Login() {
  const { login, register, isLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, email.trim() || `${username.trim()}@example.com`, displayName.trim() || username.trim());
      }
    } catch {
      // Errors are surfaced by the auth context toasts
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-serif font-bold text-neutral-900">
            {mode === "login" ? "Sign in to FF Agri-Cal" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Enter your username and password to manage your farm calendar."
              : "Choose a username and password to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-display-name">Display name</Label>
                  <Input
                    id="login-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 12 : undefined}
                maxLength={mode === "register" ? 72 : undefined}
                required
              />
              {mode === "register" && (
                <p className="text-xs text-neutral-500">Use at least 12 characters and no more than 72 UTF-8 bytes.</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary-dark" disabled={isLoading}>
              {isLoading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-sm text-neutral-500 hover:text-primary transition"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
