import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "../../types/declaration";
import { getUserById } from "../../data/db";

interface UserContextValue {
  user: User | null;
  setUser: (u: User | null) => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  isAuthenticated: false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ghe.auth.user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const freshUser = getUserById(parsed.id);
        if (freshUser) {
          setUser(freshUser);
          setIsAuthenticated(true);
        }
      } catch {
        localStorage.removeItem("ghe.auth.user");
      }
    }
  }, []);

  const login = (u: User) => {
    setUser(u);
    setIsAuthenticated(true);
    localStorage.setItem("ghe.auth.user", JSON.stringify({ id: u.id }));
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("ghe.auth.user");
  };

  return (
    <UserContext.Provider value={{ user, setUser: login, isAuthenticated, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
