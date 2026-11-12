import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";
import PasswordInput from "@/components/app/PasswordInput";
import GoogleButton from "@/components/app/GoogleButton";
import InlineNotice from "@/components/app/InlineNotice";
import { homePathFor } from "@/components/layout/nav";

const MIN_PASSWORD = 6;

const SignupPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, setAuth } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !profile) return;
    navigate(homePathFor(profile), { replace: true });
  }, [authLoading, user, profile, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? formatPhone(e.target.value) : e.target.value }));

  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("As senhas não coincidem.");
    if (!acceptTerms) return setError("É preciso aceitar os termos de uso.");
    setLoading(true);
    setError(null);
    try {
      const { token, user: newUser } = await api.auth.signup({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
        password: form.password,
        accept_terms: true,
      });
      setAuth(token, newUser); // o efeito acima leva para a busca de condomínio
    } catch (err) {
      setError(errorMessage(err, "Erro ao criar a conta"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell
      heroTagline="Seu condomínio, seu contexto"
      heroTitle="Uma vida em comunidade, com respostas mais perto."
      heroDescription="Cada morador acessa o ambiente do condomínio ao qual foi aprovado."
    >
      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <p className="eyebrow">Área do morador</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Crie sua conta de morador</h1>
          <p className="text-muted-foreground">Depois você escolhe o seu condomínio e solicita o acesso.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Nome completo" htmlFor="full_name">
            <Input id="full_name" autoComplete="name" value={form.full_name} onChange={set("full_name")} required />
          </FormField>
          <FormField label="E-mail" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" value={form.email} onChange={set("email")} required />
          </FormField>
          <FormField label="Celular" htmlFor="phone" hint="Opcional. Ajuda a administração a confirmar seu vínculo.">
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={set("phone")} />
          </FormField>
          <FormField label="Senha" htmlFor="password" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
            <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={MIN_PASSWORD} />
          </FormField>
          <FormField label="Confirmar senha" htmlFor="confirm" error={mismatch ? "As senhas não coincidem." : undefined}>
            <PasswordInput id="confirm" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required aria-invalid={mismatch} />
          </FormField>

          <label htmlFor="terms" className="flex items-start gap-3 text-sm">
            <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
            <span>Li e aceito os termos de uso e a política de privacidade do Condo App.</span>
          </label>

          {error && <InlineNotice tone="danger">{error}</InlineNotice>}

          <Button type="submit" size="lg" className="w-full" disabled={loading || mismatch || !acceptTerms}>
            {loading && <Loader2 className="animate-spin" />}
            Criar conta e buscar condomínio
          </Button>

          <GoogleButton label="Continuar com Google" disabled={loading} />
        </form>

        <p className="text-center text-sm">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold underline-offset-4 hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </div>
    </PublicShell>
  );
};

export default SignupPage;
