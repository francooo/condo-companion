import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
const LoginPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [condoSlug, setCondoSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (authLoading || !user || !profile) return;

    if (profile.role === "superadmin") navigate("/superadmin", { replace: true });
    else if (!profile.condo_id) navigate("/select-condo", { replace: true });
    else if (profile.role === "admin") navigate("/admin", { replace: true });
    else navigate("/chat", { replace: true });
  }, [authLoading, user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Authenticate first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      // Fetch profile
      const { data: profileData } = await (supabase.rpc as any)("get_my_profile");
      const userProfile = (profileData as any[])?.[0];

      if (!userProfile) {
        await supabase.auth.signOut();
        toast.error("Perfil não encontrado. Contate o administrador.");
        setLoading(false);
        return;
      }

      if (!userProfile.active) {
        await supabase.auth.signOut();
        toast.error("Sua conta está desativada. Contate o síndico.");
        setLoading(false);
        return;
      }

      // Superadmin doesn't need condo validation
      if (userProfile.role === "superadmin") {
        toast.success("Bem-vindo, Superadmin!");
        navigate("/superadmin");
        return;
      }

      // For admin/resident, validate condo slug
      if (!condoSlug.trim()) {
        await supabase.auth.signOut();
        toast.error("Informe o identificador do condomínio.");
        setLoading(false);
        return;
      }

      const { data: condo, error: condoError } = await (supabase.from as any)("condos")
        .select("id, name")
        .eq("identifier", condoSlug.trim().toLowerCase())
        .maybeSingle();

      if (condoError) throw condoError;
      if (!condo) {
        await supabase.auth.signOut();
        toast.error("Condomínio não encontrado. Verifique o identificador.");
        setLoading(false);
        return;
      }

      if (userProfile.condo_id !== condo.id) {
        await supabase.auth.signOut();
        toast.error("Você não pertence a este condomínio.");
        setLoading(false);
        return;
      }

      toast.success(`Bem-vindo ao ${condo.name}!`);

      if (userProfile.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/chat");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: condo } = await (supabase.from as any)("condos")
        .select("id")
        .eq("identifier", condoSlug.trim().toLowerCase())
        .maybeSingle();

      if (!condo) {
        toast.error("Condomínio não encontrado.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName, condo_identifier: condoSlug.trim().toLowerCase() },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      setIsSignup(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10">
            <Building2 className="h-8 w-8 text-gold" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Condo<span className="text-gold">Agent</span>
          </CardTitle>
          <CardDescription>
            {isSignup ? "Crie sua conta" : "Acesse seu condomínio"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="condo">Identificação do Condomínio</Label>
              <Input
                id="condo"
                placeholder="ex: residencial-aurora (opcional para superadmin)"
                value={condoSlug}
                onChange={(e) => setCondoSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Superadmins não precisam informar o condomínio.</p>
            </div>

            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isSignup ? "Cadastrar" : "Entrar"}
            </Button>


            <div className="relative my-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                ou
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                const redirectUrl = condoSlug.trim()
                  ? `${window.location.origin}/select-condo?condo=${encodeURIComponent(condoSlug.trim().toLowerCase())}`
                  : window.location.origin;
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: redirectUrl },
                });
                if (error) toast.error(error.message);
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </Button>

            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-muted-foreground hover:text-gold transition-colors"
              >
                {isSignup
                  ? "Já tem conta? Faça login"
                  : "Não tem conta? Cadastre-se"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/setup")}
                className="text-xs text-muted-foreground/60 hover:text-gold transition-colors"
              >
                Primeiro acesso? Configurar sistema
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
