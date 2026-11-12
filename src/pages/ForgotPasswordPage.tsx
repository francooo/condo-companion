import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";
import { StateHero } from "@/components/onboarding/Onboarding";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const send = useMutation({ mutationFn: () => api.auth.forgotPassword(email.trim()) });

  return (
    <PublicShell
      heroTagline="Acesso seguro"
      heroTitle="Recupere o acesso à sua conta."
      heroDescription="Enviamos um link para você criar uma nova senha com segurança."
    >
      <div className="space-y-6 py-2">
        {send.isSuccess ? (
          <>
            <StateHero icon={MailCheck} pill="Pedido enviado" tone="success" title="Confira seu e-mail">
              Se houver uma conta com <strong className="text-foreground">{email.trim()}</strong>, você vai receber um link para
              redefinir a senha. O link vale por 60 minutos.
            </StateHero>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to="/login">Voltar ao acesso</Link>
            </Button>
          </>
        ) : send.isError ? (
          <>
            <StateHero icon={AlertTriangle} pill="Erro na solicitação" tone="danger" title="Não foi possível enviar agora">
              Houve um problema ao processar o pedido de recuperação. Verifique sua conexão e tente novamente.
            </StateHero>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => send.reset()}>
                Ver formulário de novo
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link to="/login">Voltar ao acesso</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="eyebrow">Recuperar senha</p>
              <h1 className="text-3xl font-extrabold tracking-tight">Esqueceu sua senha?</h1>
              <p className="text-muted-foreground">Informe o e-mail da sua conta para receber o link de redefinição.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
              className="space-y-4"
            >
              <FormField label="E-mail" htmlFor="email">
                <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </FormField>
              <Button type="submit" size="lg" className="w-full" disabled={send.isPending}>
                {send.isPending && <Loader2 className="animate-spin" />}
                Solicitar recuperação
              </Button>
            </form>
            <p className="text-center text-sm">
              <Link to="/login" className="font-semibold underline-offset-4 hover:underline">
                Voltar para entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </PublicShell>
  );
};

export default ForgotPasswordPage;
