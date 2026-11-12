import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Hash, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MetricCard from "@/components/app/MetricCard";
import SectionCard from "@/components/app/SectionCard";
import StatusPill from "@/components/app/StatusPill";
import EmptyState from "@/components/app/EmptyState";
import ListRow, { ListRows } from "@/components/app/ListRow";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Datas "AAAA-MM-DD" são dias de calendário: formata sem converter fuso (evita mostrar o dia anterior). */
const dateFmt = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
};

const FinancialDashboard = () => {
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState("all");

  const categories = useQuery({ queryKey: ["financial", "categories"], queryFn: () => api.financial.categories() });
  const records = useQuery({
    queryKey: ["financial", "list", page, category],
    queryFn: () => api.financial.list({ page, pageSize: PAGE_SIZE, category: category !== "all" ? category : undefined }),
    placeholderData: (prev) => prev,
  });

  const rows = records.data?.records ?? [];
  const total = records.data?.total ?? 0;
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <MetricCard label="Total de registros" icon={Hash} value={total.toLocaleString("pt-BR")} className="col-span-2 lg:col-span-1" />
        <MetricCard label="Receitas (página)" icon={TrendingUp} value={brl(income)} hint="nesta página" hintTone="success" />
        <MetricCard label="Despesas (página)" icon={TrendingDown} value={brl(expense)} hint="nesta página" />
      </div>

      <SectionCard
        title="Lançamentos"
        aside={
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 w-48 rounded-xl" aria-label="Filtrar categoria">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(categories.data?.categories ?? []).map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {records.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhum lançamento encontrado" description="Importe uma planilha CSV para começar." />
        ) : (
          <>
            <ListRows className="lg:hidden">
              {rows.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.description || r.category}
                  meta={`${r.category} · ${dateFmt(r.date)}`}
                  trailing={
                    <span className={cn("font-semibold", r.type === "income" ? "text-success" : "text-danger")}>
                      {r.type === "income" ? "+" : "−"} {brl(Number(r.amount))}
                    </span>
                  }
                />
              ))}
            </ListRows>
            <Table className="hidden lg:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{dateFmt(r.date)}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className={cn("text-right font-semibold", r.type === "income" ? "text-success" : "text-danger")}>
                      {brl(Number(r.amount))}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={r.type === "income" ? "success" : "danger"}>{r.type === "income" ? "Receita" : "Despesa"}</StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {total > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próxima página"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default FinancialDashboard;
