import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const SelectCondoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const [slug, setSlug] = useState(searchParams.get("condo") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (profile?.condo_id) {
      navigate(profile.role === "admin" ? "/admin" : "/chat", { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim() || !user) return;
    setLoading(true);

    try {
      const { data: condo, error: condoError } = await (supabase.from as any)("condos")
        .select("id, name")
        .eq("identifier", slug.trim().toLowerCase())
        .maybeSingle();

      if (condoError) throw condoError;
      if (!condo) {
        toast.error("Condomínio não encontrado. Verifique o identificador.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await (supabase.from as any)("profiles")
        .update({ condo_id: condo.id })
        .eq("id", user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success(`Vinculado ao ${condo.name} com sucesso!`);
      navigate("/chat", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular condomínio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10">
            <Building2 className="h-8 w-8 text-gold" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Vincular Condomínio
          </CardTitle>
          <CardDescription>
            Informe o identificador do seu condomínio para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="condo-slug">Identificador do Condomínio</Label>
              <Input
                id="condo-slug"
                placeholder="ex: residencial-aurora"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Peça ao síndico ou administrador o identificador do seu condomínio.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading || !slug.trim()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Vincular
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SelectCondoPage;
