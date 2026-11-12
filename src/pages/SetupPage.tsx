import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PublicShell from "@/components/layout/PublicShell";
import FormField from "@/components/app/FormField";

const SetupPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await api.auth.bootstrapSuperadmin({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      setAuth(token, user);
      toast.success("Configuração concluída!");
      navigate("/plataforma", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao criar o administrador da plataforma"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicShell
      heroTagline="Configuração inicial"
      heroTitle="Prepare a plataforma para seus condomínios."
      heroDescription="Crie a conta de administração da plataforma. Ela gerencia condomínios, administradores e bases de conhecimento."
    >
      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <p className="eyebrow">Primeiro acesso</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Administrador da plataforma</h1>
          <p className="text-muted-foreground">Este passo só funciona enquanto não houver nenhum administrador.</p>
        </div>
        <form onSubmit={handleSetup} className="space-y-4">
          <FormField label="Nome completo" htmlFor="fullName">
            <Input id="fullName" placeholder="Nome do administrador" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </FormField>
          <FormField label="E-mail" htmlFor="email">
            <Input id="email" type="email" placeholder="admin@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FormField>
          <FormField label="Senha" htmlFor="password">
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Shield />}
            Criar administrador
          </Button>
        </form>
      </div>
    </PublicShell>
  );
};

export default SetupPage;
