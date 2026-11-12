import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileUp, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, type Condo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RulesUpload from "@/components/admin/RulesUpload";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import EmptyState from "@/components/app/EmptyState";
import CondoBadge from "@/components/app/CondoBadge";
import { PageContainer } from "@/components/layout/AppShell";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CreateCondoDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState({ address: "", city: "", state: "" });

  const create = useMutation({
    mutationFn: () =>
      api.condos.create({
        name: name.trim(),
        identifier: slugify(slug),
        address: address.address.trim() || undefined,
        city: address.city.trim() || undefined,
        state: address.state.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Condomínio cadastrado!");
      setName("");
      setSlug("");
      setSlugTouched(false);
      setAddress({ address: "", city: "", state: "" });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["condos"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Novo condomínio</DialogTitle>
          <DialogDescription>Cada condomínio tem documentos, moradores e assistente independentes.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Nome do condomínio" htmlFor="condo-name">
            <Input
              id="condo-name"
              placeholder="Residencial Aurora"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
          </FormField>
          <FormField label="Identificador" htmlFor="condo-slug" hint="Usado pelos moradores para encontrar o condomínio.">
            <Input
              id="condo-slug"
              placeholder="residencial-aurora"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              required
            />
          </FormField>
          <FormField label="Endereço" htmlFor="condo-address" hint="Ajuda os moradores a encontrarem o condomínio na busca.">
            <Input id="condo-address" placeholder="Rua das Acácias, 240" value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <FormField label="Cidade" htmlFor="condo-city">
              <Input id="condo-city" placeholder="São Paulo" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </FormField>
            <FormField label="UF" htmlFor="condo-state">
              <Input id="condo-state" placeholder="SP" maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} />
            </FormField>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Cadastrar condomínio
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CreateAdminDialog = ({ condo, onClose }: { condo: Condo | null; onClose: () => void }) => {
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const create = useMutation({
    mutationFn: () =>
      api.admins.create({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), condo_id: condo!.id }),
    onSuccess: () => {
      toast.success("Administrador criado!");
      setForm({ full_name: "", email: "", password: "" });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={Boolean(condo)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Administrador · {condo?.name}</DialogTitle>
          <DialogDescription>A administração do condomínio só acessa este ambiente.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Nome completo" htmlFor="adm-name">
            <Input id="adm-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </FormField>
          <FormField label="E-mail" htmlFor="adm-email">
            <Input id="adm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </FormField>
          <FormField label="Senha inicial" htmlFor="adm-pass">
            <Input id="adm-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Criar administrador
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const UploadDocsDialog = ({ condo, onClose }: { condo: Condo | null; onClose: () => void }) => {
  const queryClient = useQueryClient();
  return (
    <Dialog open={Boolean(condo)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Documentos · {condo?.name}</DialogTitle>
          <DialogDescription>Os documentos ficam disponíveis somente ao assistente deste condomínio.</DialogDescription>
        </DialogHeader>
        {condo && <RulesUpload condoId={condo.id} onUploaded={() => queryClient.invalidateQueries({ queryKey: ["condos"] })} />}
      </DialogContent>
    </Dialog>
  );
};

const CondosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [adminFor, setAdminFor] = useState<Condo | null>(null);
  const [docsFor, setDocsFor] = useState<Condo | null>(null);
  const createOpen = searchParams.get("novo") === "1";
  const setCreateOpen = (o: boolean) => setSearchParams(o ? { novo: "1" } : {}, { replace: true });

  const { data, isLoading } = useQuery({ queryKey: ["condos"], queryFn: () => api.condos.list() });
  const condos = useMemo(() => data?.condos ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? condos.filter((c) => c.name.toLowerCase().includes(q) || c.identifier.includes(q)) : condos;
  }, [condos, search]);

  const rowActions = (c: Condo) => (
    <div className="flex flex-wrap gap-2 lg:flex-nowrap">
      <Button variant="outline" size="sm" onClick={() => setDocsFor(c)}>
        <FileUp /> Documentos
      </Button>
      <Button variant="outline" size="sm" onClick={() => setAdminFor(c)}>
        <UserPlus /> Administrador
      </Button>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Plataforma", "Condomínios"]}
        title="Condomínios"
        description="Ambientes cadastrados na plataforma, cada um com sua base de conhecimento."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Adicionar condomínio
          </Button>
        }
      />

      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar condomínio" aria-label="Buscar condomínio" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
      </div>

      <SectionCard title="Todos os condomínios" aside={<CountBadge>{condos.length} cadastrados</CountBadge>}>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={condos.length === 0 ? "Nenhum condomínio cadastrado" : "Nenhum resultado"}
            description={condos.length === 0 ? "Cadastre o primeiro condomínio da plataforma." : "Ajuste os termos da busca."}
          />
        ) : (
          <>
            <div className="divide-y divide-border lg:hidden">
              {filtered.map((c) => (
                <div key={c.id} className="space-y-3 py-4">
                  <div className="flex items-center gap-4">
                    <CondoBadge name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[c.city, `${c.resident_count ?? 0} moradores`, `${c.doc_count ?? 0} trechos`].filter(Boolean).join(" · ")}
                      </p>
                      {(c.pending_count ?? 0) > 0 && <p className="text-sm font-semibold text-warning">{c.pending_count} solicitações pendentes</p>}
                    </div>
                  </div>
                  {rowActions(c)}
                </div>
              ))}
            </div>
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Condomínio</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Moradores</TableHead>
                  <TableHead>Base de conhecimento</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CondoBadge name={c.name} size="sm" />
                        <div>
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.identifier}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.resident_count ?? 0}
                      {(c.pending_count ?? 0) > 0 && <span className="ml-2 text-xs font-semibold text-warning">+{c.pending_count} pendentes</span>}
                    </TableCell>
                    <TableCell>{c.doc_count ?? 0} trechos</TableCell>
                    <TableCell className="whitespace-nowrap">{dateFmt.format(new Date(c.created_at))}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">{rowActions(c)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>

      <CreateCondoDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CreateAdminDialog condo={adminFor} onClose={() => setAdminFor(null)} />
      <UploadDocsDialog condo={docsFor} onClose={() => setDocsFor(null)} />
    </PageContainer>
  );
};

export default CondosPage;
