import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, Circle, FileText, FlaskConical, Loader2, Settings2 } from "lucide-react";
import { agentIcon, AGENT_TONES } from "@/lib/agent";
import { shortDate } from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import StatusPill from "@/components/app/StatusPill";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import ListRow, { ListRows } from "@/components/app/ListRow";
import { PageContainer } from "@/components/layout/AppShell";
import { useAgentSettings } from "./useAgentSettings";

const Step = ({ done, children }: { done: boolean; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="Concluído" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-label="Pendente" />}
    <span className={done ? "text-muted-foreground line-through decoration-muted-foreground/40" : undefined}>{children}</span>
  </li>
);

const AgentPage = () => {
  const { scope, query, availability, agentPath } = useAgentSettings();
  const docsPath = `${scope.basePath}/documentos`;

  if (!query.data) {
    return (
      <PageContainer>
        {query.isError ? (
          <InlineNotice tone="danger">Não foi possível carregar o assistente.</InlineNotice>
        ) : (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
          </div>
        )}
      </PageContainer>
    );
  }

  const { settings: s, readiness: r } = query.data;
  const Icon = agentIcon(s.avatar_icon);
  const { counts } = r;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[scope.areaLabel, "Agente de IA"]}
        title={s.name}
        description={`Assistente que responde aos moradores de ${scope.condoName} com base nos documentos processados.`}
        actions={
          <Button asChild size="lg">
            <Link to={`${agentPath}/teste`}>
              <FlaskConical /> Testar o agente
            </Link>
          </Button>
        }
      />

      {r.status === "incomplete" && (
        <SectionCard title="Antes de liberar aos moradores">
          <div className="space-y-5">
            <InlineNotice tone="warning">
              <strong>Configuração incompleta · {scope.condoName}.</strong> Ainda não há documentos processados e ativos. Sem eles o
              assistente não tem o que consultar e não deve ser oferecido aos moradores.
            </InlineNotice>
            <ol className="space-y-3">
              <Step done={counts.total > 0}>Adicione documentos oficiais à biblioteca de {scope.condoName}.</Step>
              <Step done={counts.available > 0}>Aguarde o processamento e revise os arquivos que precisarem de atenção.</Step>
              <Step done={false}>Teste o agente e libere o acesso aos moradores.</Step>
            </ol>
            <Button asChild variant="outline">
              <Link to={counts.total > 0 ? docsPath : `${docsPath}/novo`}>
                <FileText /> {counts.total > 0 ? "Abrir biblioteca" : "Adicionar documentos"}
              </Link>
            </Button>
          </div>
        </SectionCard>
      )}

      {r.status !== "incomplete" && (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <IconTile icon={Icon} size="lg" />
            <StatusPill status={r.status === "available" ? "available" : "ready"}>
              {r.status === "available" ? "Agente disponível" : "Base de conhecimento pronta"}
            </StatusPill>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {r.status === "available" ? "Agente disponível" : "Pronto para os moradores"}
            </h2>
            <p className="max-w-md text-muted-foreground">
              {r.status === "available"
                ? `Os moradores de ${scope.condoName} já conversam com o ${s.name}.`
                : `A base tem documentos processados. Teste o agente e libere quando estiver satisfeito com as respostas.`}
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Disponibilidade">
        <div className="space-y-4">
          <label htmlFor="agent-enabled" className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
            <span>
              <span className="block font-semibold">Disponível para os moradores</span>
              <span className="block text-sm text-muted-foreground">
                {r.enabled
                  ? "Moradores aprovados podem conversar com o assistente."
                  : "Os moradores veem que o assistente está em preparação."}
              </span>
            </span>
            <Switch
              id="agent-enabled"
              checked={r.enabled}
              disabled={availability.isPending || (!r.enabled && counts.available === 0)}
              onCheckedChange={(v) => availability.mutate(v)}
            />
          </label>
          {r.enabled && counts.available === 0 && (
            <InlineNotice tone="warning">
              O assistente está liberado, mas não há documentos ativos: ele vai responder que não encontrou as informações.
            </InlineNotice>
          )}
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={counts.available ? "success" : "neutral"}>
              {counts.available === 1 ? "1 documento ativo" : `${counts.available} documentos ativos`}
            </StatusPill>
            {counts.processing > 0 && <StatusPill tone="warning">{counts.processing} em processamento</StatusPill>}
            {counts.attention > 0 && <StatusPill tone="danger">{counts.attention} precisam de atenção</StatusPill>}
            {counts.inactive > 0 && <StatusPill tone="neutral">{counts.inactive} desativados</StatusPill>}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Gerenciar">
        <ListRows>
          <ListRow
            to={`${agentPath}/configuracoes`}
            leading={<IconTile icon={Settings2} />}
            title="Identidade e personalidade"
            meta={`${s.name} · tom ${AGENT_TONES.find((t) => t.value === s.tone)?.label.toLowerCase()} · ${s.suggestions.length} sugestões`}
          />
          <ListRow
            to={`${agentPath}/fontes`}
            leading={<IconTile icon={FileText} />}
            title="Fontes de conhecimento"
            meta={`${counts.available} de ${counts.total} documentos disponíveis ao agente`}
          />
          <ListRow
            to={`${agentPath}/teste`}
            leading={<IconTile icon={FlaskConical} />}
            title="Testar o agente"
            meta="Pergunte como um morador, sem gravar conversa"
          />
        </ListRows>
        {s.updated_at && (
          <p className="mt-4 text-sm text-muted-foreground">
            Última alteração em {shortDate.format(new Date(s.updated_at))}
            {s.updated_by_name ? ` por ${s.updated_by_name}` : ""}.
          </p>
        )}
      </SectionCard>

      <Link to={docsPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        Ir para a biblioteca de documentos <ChevronRight className="h-4 w-4" />
      </Link>
    </PageContainer>
  );
};

export default AgentPage;
