import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eraser, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api, type ChatSource } from "@/lib/api";
import { agentIcon } from "@/lib/agent";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import ChatMessage, { ThinkingBubble, type UiMessage } from "@/components/chat/ChatMessage";
import { PageContainer } from "@/components/layout/AppShell";
import { useAgentSettings } from "./useAgentSettings";

let seq = 0;

/** Teste do agente: mesma lógica do chat, sem gravar conversa e mesmo antes de liberar aos moradores. */
const AgentTestPage = () => {
  const { scope, query, agentPath } = useAgentSettings();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const settings = query.data?.settings;
  const readiness = query.data?.readiness;
  const Icon = agentIcon(settings?.avatar_icon);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setInput("");
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `u${seq++}`, role: "user", content: q, createdAt: now }]);
    setThinking(true);
    try {
      const { answer } = await api.agent.test(q, { condoId: scope.apiCondoId });
      setMessages((m) => [
        ...m,
        { id: `a${seq++}`, role: "assistant", content: answer.content, outcome: answer.outcome, sources: answer.sources, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível testar o agente."));
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setThinking(false);
    }
  };

  // No teste, a fonte abre o documento na biblioteca da administração.
  const sourceHref = (s: ChatSource) => `${scope.basePath}/documentos/${s.document_id}`;

  return (
    <PageContainer>
      <Link to={agentPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Agente de IA
      </Link>
      <PageHeader
        eyebrow={[scope.areaLabel, "Teste do agente"]}
        title="Prévia da conversa"
        description="Pergunte como um morador. As respostas usam os documentos e a configuração atuais, e nada é gravado."
      />

      {readiness?.status === "incomplete" && (
        <InlineNotice tone="warning">
          Ainda não há documentos processados e ativos: o agente vai responder que não encontrou as informações.
        </InlineNotice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <SectionCard title="Simulação" bodyClassName="overflow-hidden rounded-3xl border border-border">
          <div className="flex items-center gap-3 bg-foreground px-4 py-3 text-background">
            <IconTile icon={Icon} size="sm" className="bg-gradient-to-br from-brand-soft to-primary text-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{settings?.name ?? "Assistente"}</p>
              <p className="text-xs opacity-70">Modo de teste · nada é gravado</p>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="text-background hover:bg-background/10 hover:text-background" aria-label="Limpar conversa de teste" onClick={() => setMessages([])}>
                <Eraser />
              </Button>
            )}
          </div>
          <div ref={scrollRef} className="h-[28rem] space-y-5 overflow-y-auto bg-gradient-to-b from-card to-background px-4 py-5" aria-live="polite">
            {messages.length === 0 && !thinking && (
              <p className="py-16 text-center text-sm text-muted-foreground">Escreva uma pergunta ou escolha um exemplo.</p>
            )}
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} condoName={scope.condoName} agentIcon={Icon} sourceHref={sourceHref} />
            ))}
            {thinking && <ThinkingBubble icon={Icon} />}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-card p-3"
          >
            <label htmlFor="test-input" className="sr-only">
              Pergunta de teste
            </label>
            <input
              id="test-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              autoComplete="off"
              placeholder="Pergunte algo sobre o condomínio..."
              className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
            <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-2xl" disabled={thinking || !input.trim()} aria-label="Enviar pergunta de teste">
              {thinking ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Exemplos para testar" description="As sugestões que os moradores veem no chat.">
          <ul className="divide-y divide-border">
            {(settings?.suggestions ?? []).map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  disabled={thinking}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-semibold hover:underline disabled:opacity-50"
                >
                  {s}
                  <span className="shrink-0 rounded-xl bg-muted px-2.5 py-1 text-xs text-muted-foreground">Exemplo {i + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </PageContainer>
  );
};

export default AgentTestPage;
