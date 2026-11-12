import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";
import PasswordInput from "@/components/app/PasswordInput";
import InlineNotice from "@/components/app/InlineNotice";
import { StateHero } from "@/components/onboarding/Onboarding";

const MIN_PASSWORD = 6;

const ResetPasswordPage = () => {
  const { token = "" } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  const reset = useMutation({ mutationFn: () => api.auth.resetPassword(token, password) });

  return (
    <PublicShell
      heroTagline="Acesso seguro"
      heroTitle="Crie uma nova senha."
      heroDescription="Escolha uma senha que você não use em outros serviços."
    >
      <div className="space-y-6 py-2">
        {reset.isSuccess ? (
          <>
            <StateHero icon={CheckCircle2} pill="Senha atualizada" tone="success" title="Tudo certo!">
              Sua senha foi redefinida. Entre com a nova senha para continuar.
            </StateHero>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">Entrar</Link>
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="eyebrow">Redefinir senha</p>
              <h1 className="text-3xl font-extrabold tracking-tight">Nova senha</h1>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!mismatch) reset.mutate();
              }}
              className="space-y-4"
            >
              <FormField label="Nova senha" htmlFor="password" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
                <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN_PASSWORD} />
              </FormField>
              <FormField label="Confirmar nova senha" htmlFor="confirm" error={mismatch ? "As senhas não coincidem." : undefined}>
                <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch} />
              </FormField>
              {reset.isError && (
                <InlineNotice tone="danger">
                  {errorMessage(reset.error, "Não foi possível redefinir a senha.")}{" "}
                  <Link to="/recuperar-senha" className="font-semibold underline">
                    Solicitar novo link
                  </Link>
                </InlineNotice>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={reset.isPending || mismatch}>
                {reset.isPending && <Loader2 className="animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          </>
        )}
      </div>
    </PublicShell>
  );
};

export default ResetPasswordPage;
