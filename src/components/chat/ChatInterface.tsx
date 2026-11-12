import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Loader2, MessageSquarePlus, MoreHorizontal, SendHorizontal, Settings, Sparkles, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, assetUrl, type ChatMessageRecord, type Conversation } from "@/lib/api";
import { agentIcon } from "@/lib/agent";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import EmptyState from "@/components/app/EmptyState";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn, errorMessage } from "@/lib/utils";
import ChatMessage, { ThinkingBubble, type UiMessage } from "./ChatMessage";

const MAX_CHARS = 2000;

type ConversationData = { conversation: Conversation; messages: ChatMessageRecord[] };

const toUi = (m: ChatMessageRecord): UiMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.created_at,
  outcome: m.outcome,
  sources: m.sources,
});

let tempSeq = 0;

const ChatInterface = ({ conversationId }: { conversationId?: string }) => {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  /** Perguntas que ainda não foram registradas no servidor. */
  const [pending, setPending] = useState<UiMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const condoName = profile?.condo_name || "seu condomínio";
  const firstName = profile?.full_name?.split(" ")[0];

  // Identidade configurada pela administração (nome, ícone, saudação, sugestões) e se está liberado.
  const agentQuery = useQuery({ queryKey: ["agent"], queryFn: () => api.agent.get(), staleTime: 60_000 });
  const agent = agentQuery.data?.agent;
  const AgentIcon = agentIcon(agent?.avatar_icon);
  const unavailable = agent ? !agent.enabled : false;

  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.conversations.get(conversationId!),
    enabled: Boolean(conversationId),
    retry: false,
  });

  // Trocar de conversa limpa o que estava pendente na anterior.
  useEffect(() => {
    setPending((p) => p.filter((m) => m.status === "sending"));
  }, [conversationId]);

  const messages = useMemo(
    () => [...(conversationId ? conversation.data?.messages.map(toUi) ?? [] : []), ...pending],
    [conversationId, conversation.data, pending],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const busy = thinking || Boolean(retryingId);

  const ask = async (text: string, resendId?: string) => {
    if (!text || busy || !profile?.condo_id) return;
    const tempId = resendId ?? `tmp-${tempSeq++}`;
    setPending((prev) =>
      resendId
        ? prev.map((m) => (m.id === resendId ? { ...m, status: "sending" } : m))
        : [...prev, { id: tempId, role: "user", content: text, createdAt: new Date().toISOString(), status: "sending" }],
    );
    setThinking(true);
    try {
      const res = await api.chat.ask(text, conversationId);
      const id = res.conversation.id;
      queryClient.setQueryData<ConversationData>(["conversation", id], (old) => ({
        conversation: res.conversation,
        messages: [...(old?.messages ?? []), res.user_message, res.assistant_message],
      }));
      setPending((prev) => prev.filter((m) => m.id !== tempId));
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (id !== conversationId) navigate(`/chat/${id}`, { replace: !conversationId });
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError && err.code === "agent_unavailable") {
        // A administração retirou o assistente enquanto a pessoa usava o chat.
        setPending((prev) => prev.filter((m) => m.id !== tempId));
        queryClient.invalidateQueries({ queryKey: ["agent"] });
      } else {
        setPending((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      }
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  };

  const retry = async (messageId: string) => {
    if (!conversationId || busy) return;
    setRetryingId(messageId);
    try {
      const { assistant_message } = await api.chat.retry(messageId);
      queryClient.setQueryData<ConversationData>(["conversation", conversationId], (old) =>
        old ? { ...old, messages: old.messages.map((m) => (m.id === messageId ? assistant_message : m)) } : old,
      );
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível refazer a resposta."));
    } finally {
      setRetryingId(null);
    }
  };

  const remove = useMutation({
    mutationFn: () => api.conversations.remove(conversationId!),
    onSuccess: () => {
      toast.success("Conversa apagada.");
      queryClient.removeQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate("/chat", { replace: true });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível apagar a conversa.")),
  });

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || text.length > MAX_CHARS || !online) return;
    setInput("");
    ask(text);
  };

  const notFound = conversationId && conversation.isError;
  const loadingConversation = conversationId && conversation.isLoading && pending.length === 0;
  const canSend = online && !busy && !unavailable && Boolean(input.trim()) && input.length <= MAX_CHARS;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card sm:rounded-3xl sm:border">
      {/* Cabeçalho do agente */}
      <div className="flex items-center gap-4 border-b border-border px-5 py-4">
        <div className="relative">
          <IconTile icon={AgentIcon} size="md" className="bg-tenant/25 text-foreground" />
          <span
            className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card", online && !unavailable ? "bg-success" : "bg-muted-foreground")}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          {/* No mobile o condomínio já aparece no chip da barra superior. */}
          <p className="truncate font-bold">{agent?.name ?? "Assistente"}</p>
          <p className="truncate text-sm text-muted-foreground">
            {unavailable ? "Em preparação" : online ? "Disponível" : "Sem conexão"}
            {conversation.data && <span className="hidden sm:inline"> · {conversation.data.conversation.title}</span>}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Histórico de conversas">
          <Link to="/historico">
            <History />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Opções da conversa">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[13rem] rounded-xl">
            <DropdownMenuItem onSelect={() => navigate("/chat")} disabled={!conversationId}>
              <MessageSquarePlus className="mr-2 h-4 w-4" /> Nova conversa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/historico")}>
              <History className="mr-2 h-4 w-4" /> Histórico
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/configuracoes")}>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </DropdownMenuItem>
            {conversationId && conversation.data && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-danger focus:text-danger">
                  <Trash2 className="mr-2 h-4 w-4" /> Apagar conversa
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-card to-background px-4 py-6 sm:px-6">
        {notFound ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="Conversa não encontrada"
            description="Ela pode ter sido apagada. Comece uma nova conversa com o assistente."
            action={
              <Button asChild>
                <Link to="/chat">Nova conversa</Link>
              </Button>
            }
          />
        ) : loadingConversation ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando conversa" />
          </div>
        ) : unavailable && messages.length === 0 ? (
          <EmptyState
            icon={AgentIcon}
            title="O assistente está em preparação"
            description={`A administração do ${condoName} ainda está preparando os documentos do assistente. Volte em breve.`}
          />
        ) : messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            {profile?.condo_branding?.cover_url && (
              <img
                src={assetUrl(profile.condo_branding.cover_url)!}
                alt=""
                className="mb-6 h-32 w-full rounded-3xl object-cover sm:h-40"
              />
            )}
            <IconTile icon={AgentIcon} size="lg" className="bg-tenant/25 text-foreground" />
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">{firstName ? `Olá, ${firstName}` : "Olá!"}</h2>
            <p className="mt-2 text-muted-foreground">
              {agent ? (
                <>
                  Sou o <strong className="text-foreground">{agent.name}</strong>. {agent.greeting}
                </>
              ) : (
                <>Posso ajudar a encontrar informações nos documentos deste condomínio.</>
              )}
            </p>
            <ul className="mt-6 w-full space-y-3 text-left">
              {(agent?.suggestions ?? []).map((s, i) => {
                const Icon = i % 2 === 0 ? Sparkles : FileText;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => ask(s)}
                      disabled={busy || !online}
                      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left text-sm transition-colors hover:border-primary/50 hover:bg-brand-soft/40 disabled:opacity-50"
                    >
                      <Icon className="h-5 w-5 shrink-0 text-brand-strong" aria-hidden />
                      {s}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6" aria-live="polite">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                condoName={condoName}
                conversationId={conversationId}
                onResend={() => ask(msg.content, msg.id)}
                onRetry={() => retry(msg.id)}
                retrying={retryingId === msg.id}
                actionsDisabled={busy || !online || unavailable}
                agentIcon={AgentIcon}
              />
            ))}
            {thinking && <ThinkingBubble icon={AgentIcon} />}
          </div>
        )}
      </div>

      {/* Campo de mensagem */}
      <div className="border-t border-border bg-card px-4 py-4 sm:px-6">
        {unavailable && messages.length > 0 && (
          <InlineNotice tone="info" className="mx-auto mb-3 max-w-2xl">
            O assistente foi retirado temporariamente pela administração. Seu histórico continua disponível.
          </InlineNotice>
        )}
        {!online && (
          <InlineNotice tone="warning" className="mx-auto mb-3 max-w-2xl">
            <span className="inline-flex items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden /> Sem conexão com a internet. Conecte-se para enviar perguntas ao assistente.
            </span>
          </InlineNotice>
        )}
        <form onSubmit={submit} className="mx-auto flex max-w-2xl items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Sua pergunta
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            placeholder="Pergunte algo sobre seu condomínio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={notFound || unavailable ? true : undefined}
            autoComplete="off"
            className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-3 text-base [field-sizing:content] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          />
          <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-2xl bg-tenant text-tenant-foreground hover:bg-tenant/90" disabled={!canSend} aria-label="Enviar">
            {thinking ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
        <p className={cn("mx-auto mt-2 max-w-2xl text-center text-xs", input.length > MAX_CHARS ? "text-danger" : "text-muted-foreground")}>
          {input.length > MAX_CHARS * 0.9
            ? `${input.length} de ${MAX_CHARS} caracteres`
            : "As respostas se baseiam nos documentos disponibilizados pelo condomínio."}
        </p>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Apagar conversa?"
        description="As mensagens desta conversa serão apagadas do seu histórico. Esta ação não pode ser desfeita."
        confirmLabel="Apagar conversa"
        destructive
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
};

export default ChatInterface;
