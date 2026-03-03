import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Condo {
  id: string;
  name: string;
  identifier: string;
  created_at: string;
}

const SuperAdminPage = () => {
  const { profile } = useAuth();
  const [condos, setCondos] = useState<Condo[]>([]);
  const [loading, setLoading] = useState(true);

  // Create condo form
  const [condoName, setCondoName] = useState("");
  const [condoSlug, setCondoSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Create admin form
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    fetchCondos();
  }, []);

  const fetchCondos = async () => {
    const { data } = await supabase.from("condos").select("*").order("created_at", { ascending: false });
    setCondos((data as Condo[]) || []);
    setLoading(false);
  };

  const createCondo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error } = await supabase.from("condos").insert({
        name: condoName.trim(),
        identifier: condoSlug.trim().toLowerCase().replace(/\s+/g, "-"),
      });
      if (error) throw error;
      toast.success("Condomínio criado!");
      setCondoName("");
      setCondoSlug("");
      fetchCondos();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCondoId) return;
    setCreatingAdmin(true);
    try {
      // Create user via edge function (needs service role)
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create_admin",
          email: adminEmail.trim(),
          password: adminPassword,
          full_name: adminName.trim(),
          condo_id: selectedCondoId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Admin criado com sucesso!");
      setAdminEmail("");
      setAdminPassword("");
      setAdminName("");
      setSelectedCondoId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (profile?.role !== "superadmin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao Superadmin.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <h1 className="text-3xl font-bold">Painel Superadmin</h1>

      {/* Create Condo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-gold" />
            Novo Condomínio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createCondo} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Nome</Label>
              <Input value={condoName} onChange={(e) => setCondoName(e.target.value)} placeholder="Residencial Aurora" required />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Identificador (slug)</Label>
              <Input value={condoSlug} onChange={(e) => setCondoSlug(e.target.value)} placeholder="residencial-aurora" required />
            </div>
            <Button type="submit" disabled={creating} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Condos List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gold" />
            Condomínios ({condos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {condos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.identifier}</TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCondoId(c.id)}
                          className="gap-1"
                        >
                          <UserPlus className="h-3 w-3" /> Criar Admin
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Admin para {c.name}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={createAdmin} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha</Label>
                            <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required minLength={6} />
                          </div>
                          <Button type="submit" disabled={creatingAdmin} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                            {creatingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Admin"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {condos.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum condomínio cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminPage;
