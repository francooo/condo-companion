import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";
import PasswordInput from "@/components/app/PasswordInput";
import GoogleButton from "@/components/app/GoogleButton";
import InlineNotice from "@/components/app/InlineNotice";
import { homePathFor } from "@/components/layout/nav";

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading: authLoading, setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  useEffect(() => {
    if (authLoading || !user || !profile) return;
    navigate(homePathFor(profile), { replace: true });
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user: loggedUser } = await api.auth.login({ email: email.trim(), password });
      setAuth(token, loggedUser);
      toast.success(`Bem-vindo${loggedUser.full_name ? `, ${loggedUser.full_name.split(" ")[0]}` : ""}!`);
    } catch (err) {
      setError(errorMessage(err, "Erro ao fazer login"));
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
          <p className="eyebrow">Acesso seguro</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Acesse sua conta</h1>
          <p className="text-muted-foreground">Entre com seu e-mail e senha para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FormField>

          <FormField label="Senha" htmlFor="password">
            <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FormField>

          <div className="flex justify-end">
            <Link to="/recuperar-senha" className="text-sm font-semibold underline-offset-4 hover:underline">
              Esqueci minha senha
            </Link>
          </div>

          {error && <InlineNotice tone="danger">{error}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Entrar
          </Button>

          <GoogleButton disabled={loading} />
        </form>

        <div className="flex flex-col items-center gap-2 text-sm">
          <p>
            Não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold underline-offset-4 hover:underline">
              Criar conta
            </Link>
          </p>
          <Link to="/setup" className="text-xs text-muted-foreground hover:text-foreground">
            Primeiro acesso? Configurar sistema
          </Link>
        </div>
      </div>
    </PublicShell>
  );
};

export default LoginPage;
