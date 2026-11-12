import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, type Resident } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import FormField from "@/components/app/FormField";
import StatusPill from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import ListRow, { ListRows } from "@/components/app/ListRow";
import { condoInitials } from "@/components/app/CondoBadge";

type Filter = "all" | "active" | "inactive";
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const Avatar = ({ name }: { name: string | null }) => (
  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold">
    {condoInitials(name || "?")}
  </span>
);

const AddResidentDialog = ({ condoId }: { condoId: string }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  const create = useMutation({
    mutationFn: () =>
      api.residents.create({ email: form.email.trim(), password: form.password, full_name: form.full_name.trim(), condo_id: condoId }),
    onSuccess: () => {
      toast.success("Morador adicionado!");
      setForm({ full_name: "", email: "", password: "" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Adicionar morador
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Adicionar morador</DialogTitle>
          <DialogDescription>Crie uma conta já vinculada a este condomínio.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Nome completo" htmlFor="res-name">
            <Input id="res-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </FormField>
          <FormField label="E-mail" htmlFor="res-email">
            <Input id="res-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </FormField>
          <FormField label="Senha inicial" htmlFor="res-pass" hint="Mínimo de 6 caracteres.">
            <Input id="res-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </FormField>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ResidentManagement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({ queryKey: ["residents"], queryFn: () => api.residents.list() });
  const residents = useMemo(() => data?.residents ?? [], [data]);

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.residents.setActive(id, active),
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Morador ativado" : "Morador desativado");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents.filter(
      (r) =>
        (filter === "all" || (filter === "active" ? r.active : !r.active)) &&
        (!q || (r.full_name ?? "").toLowerCase().includes(q)),
    );
  }, [residents, search, filter]);

  const roleLabel = (r: Resident) => (r.role === "admin" ? "Síndico" : "Morador");
  const canToggle = (r: Resident) => r.id !== profile?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar morador" aria-label="Buscar morador" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
        </div>
        {profile?.condo_id && <AddResidentDialog condoId={profile.condo_id} />}
      </div>

      <FilterChips<Filter>
        aria-label="Filtrar por status"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todos" },
          { value: "active", label: "Ativos" },
          { value: "inactive", label: "Inativos" },
        ]}
      />

      <SectionCard
        title={`Moradores · ${profile?.condo_name ?? "condomínio"}`}
        description="Contas vinculadas somente a este condomínio."
        aside={<CountBadge>{residents.length} no total</CountBadge>}
      >
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum morador encontrado" description="Ajuste a busca ou adicione um novo morador." />
        ) : (
          <>
            {/* Mobile: lista */}
            <ListRows className="lg:hidden">
              {filtered.map((r) => (
                <ListRow
                  key={r.id}
                  leading={<Avatar name={r.full_name} />}
                  title={r.full_name || "—"}
                  meta={`${roleLabel(r)} · desde ${dateFmt.format(new Date(r.created_at))}`}
                  trailing={
                    <div className="flex items-center gap-3">
                      <StatusPill status={r.active ? "active" : "inactive"} />
                      {canToggle(r) && (
                        <Switch
                          aria-label={r.active ? "Desativar morador" : "Ativar morador"}
                          checked={r.active}
                          onCheckedChange={(val) => toggle.mutate({ id: r.id, active: val })}
                        />
                      )}
                    </div>
                  }
                />
              ))}
            </ListRows>

            {/* Desktop: tabela */}
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Vínculo desde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.full_name} />
                        <span className="font-semibold">{r.full_name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{roleLabel(r)}</TableCell>
                    <TableCell>{dateFmt.format(new Date(r.created_at))}</TableCell>
                    <TableCell>
                      <StatusPill status={r.active ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canToggle(r) && (
                        <Switch
                          aria-label={r.active ? "Desativar morador" : "Ativar morador"}
                          checked={r.active}
                          onCheckedChange={(val) => toggle.mutate({ id: r.id, active: val })}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>
    </div>
  );
};

export default ResidentManagement;
