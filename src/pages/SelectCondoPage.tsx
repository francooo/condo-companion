import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2, LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/app/Brand";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import { homePathFor } from "@/components/layout/nav";

const RULES = [
  "Cada condomínio tem documentos e conversas independentes.",
  "A administração confirma o vínculo com uma unidade específica.",
  "O assistente responde apenas sobre o condomínio vinculado.",
];

const SelectCondoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile, signOut, loading: authLoading } = useAuth();
  const [slug, setSlug] = useState(searchParams.get("condo") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login", { replace: true });
    else if (profile?.condo_id || profile?.role === "superadmin") navigate(homePathFor(profile), { replace: true });
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !user) return;
    setLoading(true);
    try {
      const { condo } = await api.me.linkCondo(slug.trim().toLowerCase());
      await refreshProfile();
      toast.success(`Vinculado ao ${condo.name}!`);
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao vincular condomínio."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-12">
        <div className="flex items-center justify-between">
          <BrandLogo compact />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut /> Sair
          </Button>
        </div>

        <PageHeader
          eyebrow={["Entrada e acesso", "Vincular condomínio"]}
          title="Encontre seu condomínio"
          description="Informe o identificador do seu condomínio para continuar."
        />

        <SectionCard title="Identificador do condomínio">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Identificador" htmlFor="condo-slug" hint="Peça o identificador ao síndico ou à administração.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="condo-slug" placeholder="ex.: residencial-aurora" value={slug} onChange={(e) => setSlug(e.target.value)} required className="pl-11" />
              </div>
            </FormField>
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={loading || !slug.trim()}>
              {loading && <Loader2 className="animate-spin" />}
              Vincular condomínio
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Antes de acessar">
          <ul className="space-y-3">
            {RULES.map((r) => (
              <li key={r} className="flex gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check className="h-4 w-4" />
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
};

export default SelectCondoPage;
