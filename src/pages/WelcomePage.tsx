import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import PublicShell from "@/components/layout/PublicShell";
import { homePathFor } from "@/components/layout/nav";

const WelcomePage = () => {
  const { user, profile } = useAuth();
  if (user && profile) return <Navigate to={homePathFor(profile)} replace />;

  return (
    <PublicShell
      heroTagline="Inteligência para viver melhor"
      heroTitle="Seu condomínio, agora com inteligência."
      heroDescription="Tire dúvidas sobre regras, documentos e informações do seu condomínio com um assistente especializado no contexto certo."
    >
      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <p className="eyebrow">Boas-vindas</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Por onde começamos?</h1>
          <p className="text-muted-foreground">
            Entre com sua conta ou crie uma nova para solicitar acesso ao seu condomínio.
          </p>
        </div>
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/cadastro">Criar minha conta</Link>
          </Button>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Respostas baseadas nos documentos do seu condomínio.</li>
          <li>• Acesso liberado após a aprovação da administração.</li>
        </ul>
      </div>
    </PublicShell>
  );
};

export default WelcomePage;
