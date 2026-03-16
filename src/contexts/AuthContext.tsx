import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  condo_id: string | null;
  role: string;
  full_name: string | null;
  active: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (): Promise<Profile | null> => {
    const { data } = await (supabase.rpc as any)("get_my_profile");
    const rows = (data as any[]) || [];
    return rows.length > 0 ? (rows[0] as Profile) : null;
  };

  const applySession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const nextProfile = await fetchProfile();
    setProfile(nextProfile);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const nextProfile = await fetchProfile();
    setProfile(nextProfile);
  };

  useEffect(() => {
    let mounted = true;

    const safeApplySession = async (nextSession: Session | null) => {
      if (!mounted) return;
      await applySession(nextSession);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void safeApplySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      void safeApplySession(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
