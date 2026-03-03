import { Link, useLocation } from "react-router-dom";
import { Building2, MessageCircle, Settings, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  const { profile, signOut, user } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-navy text-primary-foreground">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-gold" />
          <span className="text-xl font-bold tracking-tight">CondoAgent</span>
        </Link>
        <nav className="flex items-center gap-1">
          {(profile?.role === "resident" || profile?.role === "admin") && (
            <Link
              to="/chat"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive("/chat") ? "bg-gold text-gold-foreground" : "hover:bg-navy-light"
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </Link>
          )}
          {profile?.role === "admin" && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive("/admin") ? "bg-gold text-gold-foreground" : "hover:bg-navy-light"
              }`}
            >
              <Settings className="h-4 w-4" />
              Admin
            </Link>
          )}
          {profile?.role === "superadmin" && (
            <Link
              to="/superadmin"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive("/superadmin") ? "bg-gold text-gold-foreground" : "hover:bg-navy-light"
              }`}
            >
              <Shield className="h-4 w-4" />
              Superadmin
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="ml-2 gap-1 text-primary-foreground/70 hover:text-primary-foreground hover:bg-navy-light"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
