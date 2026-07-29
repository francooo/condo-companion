import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api, Profile, setOnUnauthorized } from "@/lib/api";
import { getToken, setToken as persistToken, clearToken } from "@/lib/auth-storage";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  setAuth: (token: string, profile: Profile) => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  setAuth: () => {},
  signOut: () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = (p: Profile | null) => {
    setProfile(p);
    setUser(p ? { id: p.id, email: p.email } : null);
  };

  const signOut = useCallback(() => {
    clearToken();
    applyProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { user: p } = await api.auth.me();
      applyProfile(p);
    } catch {
      signOut();
    }
  }, [signOut]);

  useEffect(() => {
    setOnUnauthorized(() => applyProfile(null));

    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then(({ user: p }) => applyProfile(p))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const setAuth = (token: string, p: Profile) => {
    persistToken(token);
    applyProfile(p);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setAuth, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
