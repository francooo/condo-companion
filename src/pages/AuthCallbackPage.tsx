import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { setToken } from "@/lib/auth-storage";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get("token");

    if (!token) {
      toast.error("Não foi possível concluir o login com Google.");
      navigate("/login", { replace: true });
      return;
    }

    setToken(token);
    api.auth
      .me()
      .then(({ user }) => {
        setAuth(token, user);
        navigate("/login", { replace: true });
      })
      .catch(() => {
        toast.error("Não foi possível concluir o login com Google.");
        navigate("/login", { replace: true });
      });
  }, [navigate, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <Loader2 className="h-8 w-8 animate-spin text-gold" />
    </div>
  );
};

export default AuthCallbackPage;
