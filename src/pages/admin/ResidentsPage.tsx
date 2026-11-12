import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, type Resident } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { matchesResidentFilter, residentStatus, roleLabel, unitLabel, type ResidentFilter } from "@/lib/residents";
import { shortDate } from "@/lib/documents";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import FormField from "@/components/app/FormField";
import PasswordInput from "@/components/app/PasswordInput";
import StatusPill from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import ListRow, { ListRows } from "@/components/app/ListRow";
import PersonAvatar from "@/components/app/PersonAvatar";
import { PageContainer } from "@/components/layout/AppShell";

const ResidentPill = ({ r }: { r: Resident }) => {
  const s = residentStatus(r);
  return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
};

const AddResidentDialog = ({ open, onOpenChange, condoId, condoName }: { open: boolean; onOpenChange: (o: boolean) => void; condoId?: string; condoName: string }) => {
  const queryClient = useQueryClient();
  const empty = { full_name: "", email: "", password: "", unit: "", block: "" };
  const [form, setForm] = useState(empty);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const create = useMutation({
    mutationFn: () =>
      api.residents.create({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        unit: form.unit.trim(),
        block: form.block.trim() || undefined,
        condo_id: condoId,
      }),
    onSuccess: () => {
      toast.success("Morador cadastrado com acesso aprovado.");
      setForm(empty);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível cadastrar.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Cadastrar morador</DialogTitle>
          <DialogDescription>A conta já nasce com acesso aprovado ao {condoName}. Passe a senha inicial ao morador.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <FormField label="Nome completo" htmlFor="res-name">
              <Input id="res-name" value={form.full_name} onChange={set("full_name")} required />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="E-mail" htmlFor="res-email">
              <Input id="res-email" type="email" value={form.email} onChange={set("email")} required />
            </FormField>
          </div>
          <FormField label="Unidade" htmlFor="res-unit">
            <Input id="res-unit" value={form.unit} onChange={set("unit")} required maxLength={40} />
          </FormField>
          <FormField label="Bloco (opcional)" htmlFor="res-block">
            <Input id="res-block" value={form.block} onChange={set("block")} maxLength={40} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Senha inicial" htmlFor="res-pass" hint="Mínimo de 6 caracteres. O morador pode trocá-la no perfil.">
              <PasswordInput id="res-pass" autoComplete="new-password" value={form.password} onChange={set("password")} required minLength={6} />
            </FormField>
          </div>
          <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />} Cadastrar morador
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ResidentsPage = () => {
  const scope = useCondoScope();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ResidentFilter>("all");
  const [adding, setAdding] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["residents", scope.condoId],
    queryFn: () => api.residents.list(scope.apiCondoId),
    enabled: Boolean(scope.condoId),
  });
  const residents = useMemo(() => data?.residents ?? [], [data]);
  const pendingCount = residents.filter((r) => r.membership_status === "pending").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residents.filter(
      (r) => matchesResidentFilter(r, filter) && (!q || [r.full_name, r.email, r.unit, r.block].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [residents, search, filter]);

  const detailPath = (r: Resident) => `${scope.basePath}/moradores/${r.id}`;
  const requestsPath = scope.isPlatform ? "/plataforma/solicitacoes" : "/admin/solicitacoes";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[scope.areaLabel, "Moradores"]}
        title="Moradores"
        description={`Vínculos de ${scope.condoName}: quem tem acesso ao assistente, quem aguarda análise e quem está suspenso.`}
        actions={
          <>
            <Button asChild size="lg">
              <Link to={requestsPath}>
                <Clock /> Solicitações pendentes
                {pendingCount > 0 && <span className="ml-1 rounded-full bg-foreground px-2 py-0.5 text-xs text-background">{pendingCount}</span>}
              </Link>
            </Button>
            <Button variant="outline" size="lg" onClick={() => setAdding(true)}>
              <UserPlus /> Cadastrar morador
            </Button>
          </>
        }
      />

      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, e-mail ou unidade"
          aria-label="Buscar nome, e-mail ou unidade"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11"
        />
      </div>

      <FilterChips<ResidentFilter>
        aria-label="Filtrar por situação"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todos" },
          { value: "active", label: "Ativos" },
          { value: "pending", label: pendingCount ? `Pendentes (${pendingCount})` : "Pendentes" },
          { value: "suspended", label: "Suspensos" },
        ]}
      />

      <SectionCard
        title={`Moradores · ${scope.condoName}`}
        description={`Vínculos pertencem exclusivamente a ${scope.condoName}.`}
        aside={data && <CountBadge>{filtered.length === 1 ? "1 pessoa" : `${filtered.length} pessoas`}</CountBadge>}
      >
        {isError ? (
          <InlineNotice tone="danger">Não foi possível carregar os moradores.</InlineNotice>
        ) : isLoading || !data ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={residents.length ? "Nenhum morador encontrado" : "Nenhum morador ainda"}
            description={residents.length ? "Ajuste a busca ou o filtro." : "Os pedidos de vínculo aprovados e os cadastros feitos aqui aparecem nesta lista."}
          />
        ) : (
          <>
            {/* Mobile: lista */}
            <ListRows className="lg:hidden">
              {filtered.map((r) => (
                <ListRow
                  key={r.id}
                  to={detailPath(r)}
                  leading={<PersonAvatar name={r.full_name || r.email} />}
                  title={r.full_name || r.email}
                  meta={
                    <>
                      <span className="block truncate">{[unitLabel(r), r.role === "admin" ? "Síndico" : null].filter(Boolean).join(" · ") || r.email}</span>
                      <span className="mt-2 flex">
                        <ResidentPill r={r} />
                      </span>
                    </>
                  }
                />
              ))}
            </ListRows>

            {/* Desktop: tabela */}
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Morador</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(detailPath(r))}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={r.full_name || r.email} />
                        <div className="min-w-0">
                          <Link to={detailPath(r)} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                            {r.full_name || "Sem nome"}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{unitLabel(r) || "—"}</TableCell>
                    <TableCell>{roleLabel(r.role)}</TableCell>
                    <TableCell>
                      <ResidentPill r={r} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.membership_status === "pending"
                        ? `Pedido em ${shortDate.format(new Date(r.requested_at ?? r.created_at))}`
                        : shortDate.format(new Date(r.member_since))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>

      <AddResidentDialog open={adding} onOpenChange={setAdding} condoId={scope.apiCondoId} condoName={scope.condoName} />
    </PageContainer>
  );
};

export default ResidentsPage;
