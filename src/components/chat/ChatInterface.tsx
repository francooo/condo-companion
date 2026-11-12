import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, SendHorizontal, Sparkles, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import ChatMessage, { AgentAvatar } from "./ChatMessage";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  /** Mensagem do usuário que não chegou ao servidor. */
  failed?: boolean;
}

const SUGGESTIONS = [
  "Quais são as regras do condomínio?",
  "Como reservar o salão de festas?",
  "Qual é o horário permitido para obras?",
  "Posso receber visitantes?",
  "Onde encontro os comunicados?",
  "Quais são as regras para animais de estimação?",
];

const newId = () => Math.random().toString(36).slice(2);

const ChatInterface = () => {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const condoName = profile?.condo_name || "seu condomínio";
  const firstName = profile?.full_name?.split(" ")[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const ask = async (text: string, existingId?: string) => {
    if (!text || isLoading || !profile?.condo_id) return;
    const userId = existingId ?? newId();

    setMessages((prev) =>
      existingId
        ? prev.map((m) => (m.id === existingId ? { ...m, failed: false } : m))
        : [...prev, { id: userId, role: "user", content: text, createdAt: new Date() }],
    );
    setIsLoading(true);

    try {
      const data = await api.chat.ask(text);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.answer || "Desculpe, não consegui gerar uma resposta.",
          createdAt: new Date(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.map((m) => (m.id === userId ? { ...m, failed: true } : m)));
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    ask(text);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-card sm:rounded-3xl sm:border">
      {/* Cabeçalho do agente */}
      <div className="flex items-center gap-4 border-b border-border px-5 py-4">
        <div className="relative">
          <IconTile icon={Sparkles} size="md" className="bg-gradient-to-br from-brand-soft to-primary/60 text-foreground" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
              online ? "bg-success" : "bg-muted-foreground",
            )}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">Assistente {profile?.condo_name ?? ""}</p>
          <p className="text-sm text-muted-foreground">{online ? "Disponível" : "Sem conexão"}</p>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-card to-background px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <IconTile icon={Sparkles} size="lg" className="text-foreground" />
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">{firstName ? `Olá, ${firstName}` : "Olá!"}</h2>
            <p className="mt-2 text-muted-foreground">
              Sou o assistente do <strong className="text-foreground">{condoName}</strong>. Posso ajudar a encontrar
              informações nos documentos deste condomínio.
            </p>
            <ul className="mt-6 w-full space-y-3 text-left">
              {SUGGESTIONS.map((s, i) => {
                const Icon = i % 2 === 0 ? Sparkles : FileText;
                return (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => ask(s)}
                      disabled={isLoading || !online}
                      className="flex w-full items-center gap-4 rounded-2xl border text-left border-border bg-card px-5 py-4 text-sm transition-colors hover:border-primary/50 hover:bg-brand-soft/40 disabled:opacity-50"
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
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onRetry={() => ask(msg.content, msg.id)} retryDisabled={isLoading || !online} />
            ))}
            {isLoading && (
              <div className="flex gap-3" role="status">
                <AgentAvatar />
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border bg-muted/60 px-5 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando resposta…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campo de mensagem */}
      <div className="border-t border-border bg-card px-4 py-4 sm:px-6">
        {!online && (
          <InlineNotice tone="warning" className="mx-auto mb-3 max-w-2xl">
            <span className="inline-flex items-center gap-2">
              <WifiOff className="h-4 w-4" /> Sem conexão. Suas perguntas poderão ser enviadas quando a internet voltar.
            </span>
          </InlineNotice>
        )}
        <form onSubmit={submit} className="mx-auto flex max-w-2xl items-center gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Sua pergunta
          </label>
          <input
            id="chat-input"
            placeholder="Pergunte algo sobre seu condomínio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
            className="h-12 flex-1 rounded-2xl border border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          />
          <Button type="submit" size="icon" className="h-12 w-12 rounded-2xl" disabled={isLoading || !input.trim() || !online} aria-label="Enviar">
            <SendHorizontal />
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-muted-foreground">
          As respostas se baseiam nos documentos disponibilizados pelo condomínio.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
