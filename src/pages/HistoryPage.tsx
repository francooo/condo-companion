import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, MessagesSquare, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { conversationWhen } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/app/PageHeader";
import SectionCard, { CountBadge } from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import ListRow, { ListRows } from "@/components/app/ListRow";
import CondoBadge from "@/components/app/CondoBadge";
import EmptyState from "@/components/app/EmptyState";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";

type Period = "recent" | "month";

const HistoryPage = () => {
  const { profile } = useAuth();
  const condoName = profile?.condo_name ?? "seu condomínio";
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("recent");
  const q = useDebouncedValue(search.trim(), 300);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["conversations", q],
    queryFn: () => api.conversations.list(q),
    placeholderData: (prev) => prev,
  });

  const conversations = useMemo(() => {
    const all = data?.conversations ?? [];
    if (period === "recent") return all;
    const now = new Date();
    return all.filter((c) => {
      const d = new Date(c.updated_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [data, period]);

  const hasAny = Boolean(q) || (data?.conversations.length ?? 0) > 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Morador", "Histórico de conversas"]}
        title="Suas conversas"
        description={`Conversas com o assistente de ${condoName}. Só você vê o seu histórico.`}
        actions={
          <Button asChild>
            <Link to="/chat">
              <MessageSquarePlus /> Nova conversa
            </Link>
          </Button>
        }
      />

      {hasAny && (
        <>
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa"
              aria-label="Buscar conversa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11"
            />
            {isFetching && !isLoading && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Buscando" />
            )}
          </div>
          <FilterChips<Period>
            aria-label="Período"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "recent", label: "Recentes" },
              { value: "month", label: "Este mês" },
            ]}
          />
        </>
      )}

      <SectionCard
        title="Conversas anteriores"
        description={`Somente conversas de ${condoName}.`}
        aside={data && hasAny && <CountBadge>{conversations.length}</CountBadge>}
      >
        {isError ? (
          <InlineNotice tone="danger">Não foi possível carregar o histórico.</InlineNotice>
        ) : isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={hasAny ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
            description={hasAny ? "Ajuste a busca ou o período." : "Suas perguntas ao assistente ficam guardadas aqui para consultar depois."}
            action={
              !hasAny && (
                <Button asChild>
                  <Link to="/chat">Fazer uma pergunta</Link>
                </Button>
              )
            }
          />
        ) : (
          <ListRows>
            {conversations.map((c) => (
              <ListRow
                key={c.id}
                to={`/chat/${c.id}`}
                leading={<CondoBadge name={condoName} />}
                title={c.title}
                meta={`${condoName} · ${conversationWhen(c.updated_at)}`}
                trailing={
                  <span className="hidden shrink-0 rounded-xl bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
                    {c.has_sources ? "Resposta com fontes" : `${c.message_count} mensagens`}
                  </span>
                }
              />
            ))}
          </ListRows>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default HistoryPage;
