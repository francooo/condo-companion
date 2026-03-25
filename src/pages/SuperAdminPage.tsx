import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, UserPlus, Loader2, Upload, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isAcceptedFile, getTextFromFile } from "@/lib/pdf-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Condo {
  id: string;
  name: string;
  identifier: string;
  created_at: string;
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
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

  // Document upload
  const [uploadingCondoId, setUploadingCondoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCondos();
  }, []);

  const fetchCondos = async () => {
    const { data } = await (supabase.from as any)("condos").select("*").order("created_at", { ascending: false });
    const condoList = (data as Condo[]) || [];
    setCondos(condoList);
    setLoading(false);

    // Fetch document counts per condo
    if (condoList.length > 0) {
      const counts: Record<string, number> = {};
      for (const c of condoList) {
        const { count } = await (supabase.from as any)("knowledge_base")
          .select("*", { count: "exact", head: true })
          .eq("condo_id", c.id);
        counts[c.id] = count || 0;
      }
      setDocCounts(counts);
    }
  };

  const createCondo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error } = await (supabase.from as any)("condos").insert({
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, condoId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      toast.error("Formato não suportado. Use TXT.");
      return;
    }

    setUploadingCondoId(condoId);
    setIsUploading(true);
    setUploadedCount(0);

    try {
      const text = await file.text();
      const chunks = chunkText(text);
      toast.info(`Processando ${chunks.length} trechos...`);

      const { data, error } = await supabase.functions.invoke("process-embeddings", {
        body: {
          chunks,
          metadata: { filename: file.name },
          condo_id: condoId,
        },
      });

      if (error) throw error;

      setUploadedCount(chunks.length);
      toast.success(`${chunks.length} trechos processados e salvos!`);
      fetchCondos(); // refresh doc counts
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = "";
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
          <CardDescription>
            Gerencie condomínios, crie admins e faça upload de documentos para a IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {condos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.identifier}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {docCounts[c.id] ?? "—"} trechos
                    </span>
                  </TableCell>
                  <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Upload Documents */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            <Upload className="h-3 w-3" /> Documentos
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload de Documentos — {c.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <p className="text-sm text-muted-foreground">
                              Faça upload de arquivos TXT com regras, regimento ou informações do condomínio.
                              A IA usará esses documentos para responder aos moradores.
                            </p>
                            <Input
                              type="file"
                              accept=".txt"
                              onChange={(e) => handleFileUpload(e, c.id)}
                              disabled={isUploading && uploadingCondoId === c.id}
                              className="cursor-pointer"
                            />
                            {isUploading && uploadingCondoId === c.id && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processando e gerando embeddings...
                              </div>
                            )}
                            {uploadedCount > 0 && !isUploading && uploadingCondoId === c.id && (
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                {uploadedCount} trechos salvos na base de conhecimento
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* Create Admin */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCondoId(c.id)}
                            className="gap-1"
                          >
                            <UserPlus className="h-3 w-3" /> Admin
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {condos.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum condomínio cadastrado. Crie o primeiro acima.
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
