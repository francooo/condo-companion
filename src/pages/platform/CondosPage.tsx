import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Search } from "lucide-react";
import { api, type Condo } from "@/lib/api";
import { shortDate } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import EmptyState from "@/components/app/EmptyState";
import StatusPill from "@/components/app/StatusPill";
import CondoBadge from "@/components/app/CondoBadge";
import ListRow, { ListRows } from "@/components/app/ListRow";
import { PageContainer } from "@/components/layout/AppShell";

type StatusFilter = "all" | "active" | "inactive";

const nameOf = (c: Condo) => c.display_name || c.name;

const CondosPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const { data, isLoading } = useQuery({ queryKey: ["condos"], queryFn: () => api.condos.list() });
  const condos = useMemo(() => data?.condos ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return condos.filter(
      (c) =>
        (status === "all" || (c.status ?? "active") === status) &&
        (!q || [c.name, c.display_name, c.identifier, c.city].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [condos, search, status]);

  // Link antigo do painel ("?novo=1") abria um diálogo; hoje o cadastro tem página própria.
  if (searchParams.get("novo") === "1") return <Navigate to="/plataforma/condominios/novo" replace />;

  const detail = (c: Condo) => `/plataforma/condominios/${c.id}`;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Plataforma", "Condomínios"]}
        title="Condomínios"
        description="Ambientes independentes na plataforma, cada um com identidade, moradores e base documental próprios."
        actions={
          <Button asChild size="lg">
            <Link to="/plataforma/condominios/novo">
              <Plus /> Adicionar condomínio
            </Link>
          </Button>
        }
      />

      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome, identificador ou cidade" aria-label="Buscar condomínio" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
      </div>
      <FilterChips<StatusFilter>
        aria-label="Situação"
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Todos" },
          { value: "active", label: "Ativos" },
          { value: "inactive", label: "Inativos" },
        ]}
      />

      <SectionCard title="Todos os condomínios" aside={data && <CountBadge>{filtered.length === 1 ? "1 condomínio" : `${filtered.length} condomínios`}</CountBadge>}>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={condos.length === 0 ? "Nenhum condomínio cadastrado" : "Nenhum resultado"}
            description={condos.length === 0 ? "Cadastre o primeiro condomínio da plataforma." : "Ajuste a busca ou o filtro."}
          />
        ) : (
          <>
            <ListRows className="lg:hidden">
              {filtered.map((c) => (
                <ListRow
                  key={c.id}
                  to={detail(c)}
                  leading={<CondoBadge name={nameOf(c)} logoUrl={c.logo_url} color={c.primary_color} />}
                  title={nameOf(c)}
                  meta={
                    <>
                      <span className="block">{[c.city, `${c.resident_count ?? 0} moradores`, `${c.doc_count ?? 0} documentos`].filter(Boolean).join(" · ")}</span>
                      {(c.pending_count ?? 0) > 0 && <span className="block font-semibold text-warning">{c.pending_count} solicitações pendentes</span>}
                      {c.status === "inactive" && (
                        <span className="mt-2 flex">
                          <StatusPill status="inactive" />
                        </span>
                      )}
                    </>
                  }
                />
              ))}
            </ListRows>
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Condomínio</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Moradores</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(detail(c))}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CondoBadge name={nameOf(c)} logoUrl={c.logo_url} color={c.primary_color} size="sm" />
                        <div className="min-w-0">
                          <Link to={detail(c)} className="font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                            {nameOf(c)}
                          </Link>
                          <p className="text-xs text-muted-foreground">{c.identifier}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.resident_count ?? 0}
                      {(c.pending_count ?? 0) > 0 && <span className="ml-2 text-xs font-semibold text-warning">+{c.pending_count} pendentes</span>}
                    </TableCell>
                    <TableCell>{c.doc_count ?? 0}</TableCell>
                    <TableCell>
                      <StatusPill status={(c.status ?? "active") === "active" ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{shortDate.format(new Date(c.created_at))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default CondosPage;
