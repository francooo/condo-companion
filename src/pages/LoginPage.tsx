import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";
import { homePathFor } from "@/components/layout/nav";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading: authLoading, setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [condoSlug, setCondoSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(searchParams.get("modo") === "cadastro");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) toast.error(oauthError);
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user || !profile) return;
    navigate(homePathFor(profile), { replace: true });
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { token, user: newUser } = await api.auth.signup({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          condo_identifier: condoSlug.trim().toLowerCase(),
        });
        setAuth(token, newUser);
        toast.success("Conta criada com sucesso!");
      } else {
        const { token, user: loggedUser } = await api.auth.login({
          email: email.trim(),
          password,
          condo_identifier: condoSlug.trim() || undefined,
        });
        setAuth(token, loggedUser);
        toast.success(`Bem-vindo, ${loggedUser.full_name || "de volta"}!`);
      }
    } catch (err) {
      toast.error(errorMessage(err, isSignup ? "Erro ao cadastrar" : "Erro ao fazer login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell
      heroTagline="Seu condomínio, seu contexto"
      heroTitle="Informação confiável começa com o contexto certo."
      heroDescription="Um espaço claro para moradores encontrarem orientações e documentos do próprio condomínio."
    >
      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <p className="eyebrow">{isSignup ? "Criar conta" : "Acesso seguro"}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{isSignup ? "Crie sua conta" : "Acesse sua conta"}</h1>
          <p className="text-muted-foreground">
            {isSignup
              ? "Informe seus dados e o identificador do seu condomínio."
              : "Entre com seu e-mail e senha para continuar."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <FormField label="Nome completo" htmlFor="fullName">
              <Input id="fullName" autoComplete="name" placeholder="Seu nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </FormField>
          )}

          <FormField label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FormField>

          <FormField label="Senha" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField
            label="Identificador do condomínio"
            htmlFor="condo"
            hint={isSignup ? "Peça o identificador à administração do condomínio." : "Administradores da plataforma não precisam informar."}
          >
            <Input id="condo" placeholder="ex.: residencial-aurora" value={condoSlug} onChange={(e) => setCondoSlug(e.target.value)} required={isSignup} />
          </FormField>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {isSignup ? "Criar conta" : "Entrar"}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={loading}
            onClick={() => {
              window.location.href = api.auth.googleUrl(condoSlug.trim() || undefined);
            }}
          >
            <GoogleIcon />
            Entrar com Google
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <button type="button" onClick={() => setIsSignup((v) => !v)} className="font-semibold hover:underline">
            {isSignup ? "Já tem conta? Entrar" : "Não tem conta? Criar conta"}
          </button>
          <Link to="/setup" className="text-xs text-muted-foreground hover:text-foreground">
            Primeiro acesso? Configurar sistema
          </Link>
        </div>
      </div>
    </PublicShell>
  );
};

export default LoginPage;
