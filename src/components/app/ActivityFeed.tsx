import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { describeActivity } from "@/lib/activity";
import { relativeTime } from "@/lib/format";
import SectionCard from "./SectionCard";
import IconTile from "./IconTile";
import StatusPill from "./StatusPill";
import EmptyState from "./EmptyState";
import InlineNotice from "./InlineNotice";

interface ActivityFeedProps {
  title?: string;
  description?: string;
  /** Filtra um condomínio (plataforma). O admin do condomínio sempre vê só o próprio. */
  condoId?: string;
  /** Mostra o nome do condomínio em cada evento (visão de toda a plataforma). */
  showCondo?: boolean;
  limit?: number;
}

/** Atividade recente: vínculos, documentos, agente e identidade visual. */
const ActivityFeed = ({ title = "Atividade recente", description, condoId, showCondo = false, limit = 8 }: ActivityFeedProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", condoId ?? "all", limit],
    queryFn: () => api.insights.activity({ condoId, limit }),
  });

  return (
    <SectionCard title={title} description={description}>
      {isError ? (
        <InlineNotice tone="danger">Não foi possível carregar a atividade.</InlineNotice>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      ) : !data?.events.length ? (
        <EmptyState icon={Activity} title="Nada por aqui ainda" description="Pedidos de vínculo, documentos e ajustes do assistente aparecem aqui." />
      ) : (
        <ul className="divide-y divide-border">
          {data.events.map((e) => {
            const d = describeActivity(e, showCondo);
            return (
              <li key={e.id} className="flex items-start gap-4 py-4">
                <IconTile icon={d.icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {[d.detail, relativeTime(e.created_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusPill tone={d.tone} className="hidden sm:inline-flex">
                  {d.pill}
                </StatusPill>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
};

export default ActivityFeed;
