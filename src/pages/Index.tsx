import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (profile?.role === "superadmin") navigate("/superadmin");
    else if (!profile?.condo_id) navigate("/select-condo");
    else if (profile?.role === "admin") navigate("/admin");
    else navigate("/chat");
  }, [loading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy">
      <Loader2 className="h-8 w-8 animate-spin text-gold" />
    </div>
  );
};

export default Index;
