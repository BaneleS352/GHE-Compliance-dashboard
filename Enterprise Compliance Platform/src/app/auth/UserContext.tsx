import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { User } from "@/types/declaration";
import { fetchCurrentUser, isIdentityAuthenticated, logoutFromIdentityProvider } from "./authService";
import { initializeIdentity } from "./msal";
interface UserContextValue { user: User | null; setUser: (u: User | null) => void; isAuthenticated: boolean; logout: () => void; loading: boolean; }
const UserContext = createContext<UserContextValue>({ user: null, setUser: () => {}, isAuthenticated: false, logout: () => {}, loading: true });
export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { initializeIdentity().then(async () => { if (isIdentityAuthenticated()) setUser(await fetchCurrentUser()); }).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const login = useCallback((u: User | null) => setUser(u), []);
  const logout = useCallback(() => { setUser(null); logoutFromIdentityProvider(); }, []);
  const value = useMemo(() => ({ user, setUser: login, isAuthenticated: !!user, logout, loading }), [user, login, logout, loading]);
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
export function useUser() { return useContext(UserContext); }
