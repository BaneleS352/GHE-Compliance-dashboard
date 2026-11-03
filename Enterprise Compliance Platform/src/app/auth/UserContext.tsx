import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { User } from "@/types/declaration";
import { fetchCurrentUser, isIdentityAuthenticated, logoutFromIdentityProvider } from "./authService";
import { initializeIdentity } from "./msal";
import { configureApiTokenProvider } from "@/services/authToken";
import { getApiToken } from "./msal";
interface UserContextValue { user: User | null; setUser: (u: User | null) => void; isAuthenticated: boolean; logout: () => void; loading: boolean; }
const UserContext = createContext<UserContextValue>({ user: null, setUser: () => {}, isAuthenticated: false, logout: () => {}, loading: true });
export function UserProvider({ children }: { children: ReactNode }) {
  configureApiTokenProvider(getApiToken);
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const loadIdentity = useCallback(async () => {
    setLoading(true);
    setIdentityError(null);
    try {
      await initializeIdentity();
      if (isIdentityAuthenticated()) setUser(await fetchCurrentUser());
    } catch (error) {
      console.error("Identity service unavailable", error);
      setIdentityError("Sign-in services are temporarily unavailable. Check your connection and retry.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadIdentity(); }, [loadIdentity]);
  const login = useCallback((u: User | null) => setUser(u), []);
  const logout = useCallback(() => { setUser(null); logoutFromIdentityProvider(); }, []);
  const value = useMemo(() => ({ user, setUser: login, isAuthenticated: !!user, logout, loading }), [user, login, logout, loading]);
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  return <UserContext.Provider value={value}>{identityError ? <main role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><p>{identityError}</p><button className="rounded-lg bg-purple-800 px-4 py-2 text-white" onClick={() => void loadIdentity()}>Retry</button></main> : children}</UserContext.Provider>;
}
export function useUser() { return useContext(UserContext); }
