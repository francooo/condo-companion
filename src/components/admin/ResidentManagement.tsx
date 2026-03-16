import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Resident {
  id: string;
  full_name: string | null;
  role: string;
  active: boolean;
  created_at: string;
}

const ResidentManagement = () => {
  const { profile } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (profile?.condo_id) fetchResidents();
  }, [profile?.condo_id]);

  const fetchResidents = async () => {
    const { data } = await (supabase.from as any)("profiles")
      .select("id, full_name, role, active, created_at")
      .eq("condo_id", profile!.condo_id!)
      .order("created_at", { ascending: false });
    setResidents((data as Resident[]) || []);
    setLoading(false);
  };

  const inviteResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create_resident",
          email: inviteEmail.trim(),
          password: invitePassword,
          full_name: inviteName.trim(),
          condo_id: profile!.condo_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Morador criado com sucesso!");
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      fetchResidents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (residentId: string, active: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ active })
      .eq("id", residentId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(active ? "Morador ativado" : "Morador desativado");
    fetchResidents();
  };

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold" />
            Adicionar Morador
          </CardTitle>
          <CardDescription>Crie uma conta para um novo morador do condomínio.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={inviteResident} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" required />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="morador@email.com" required />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="••••••" required minLength={6} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviting} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Residents list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            Moradores ({residents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${r.role === "admin" ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"}`}>
                      {r.role === "admin" ? "Síndico" : "Morador"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs ${r.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {r.active ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    {r.id !== profile?.id && (
                      <Switch checked={r.active} onCheckedChange={(val) => toggleActive(r.id, val)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {residents.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum morador cadastrado
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

export default ResidentManagement;
