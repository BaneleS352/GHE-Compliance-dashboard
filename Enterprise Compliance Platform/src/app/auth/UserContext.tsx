import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { User } from "../../types/declaration";
import { clearToken } from "../../services/httpClient";
import { fetchCurrentUser } from "./authService";

interface UserContextValue {
  user: User | null;
  setUser: (u: User | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  isAuthenticated: false,
  logout: () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ghe.auth.token");
    if (!token) {
      localStorage.removeItem("ghe.auth.user");
      setLoading(false);
      return;
    }
    const cached = localStorage.getItem("ghe.auth.user");
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignore */ }
    }
    fetchCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        localStorage.setItem("ghe.auth.user", JSON.stringify(u));
      } else {
        setUser(null);
        clearToken();
        localStorage.removeItem("ghe.auth.user");
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback((u: User | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem("ghe.auth.user", JSON.stringify(u));
    } else {
      localStorage.removeItem("ghe.auth.user");
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    localStorage.removeItem("ghe.auth.user");
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, setUser: login, isAuthenticated: !!user, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
