import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { AlertCircle, ChevronRight, FileText, Loader2, RotateCw, Sparkles } from "lucide-react";
import type { ChatOutcome, ChatSource } from "@/lib/api";
import IconTile from "@/components/app/IconTile";
import { cn } from "@/lib/utils";
import { chatTime } from "@/lib/format";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  outcome?: ChatOutcome | null;
  sources?: ChatSource[];
  /** Pergunta ainda não registrada no servidor (enviando ou falhou ao enviar). */
  status?: "sending" | "failed";
}

/** Título em destaque para respostas que não são uma resposta comum. */
const OUTCOME_TITLE: Partial<Record<ChatOutcome, string>> = {
  not_found: "Não encontrei essa informação",
  out_of_scope: "Fora do que posso responder",
  error: "Não foi possível concluir agora",
};

export const AgentAvatar = () => (
  <IconTile icon={Sparkles} size="sm" className="mt-1 bg-gradient-to-br from-brand-soft to-primary/60 text-foreground" />
);

export const ThinkingBubble = () => (
  <div className="flex gap-3" role="status" aria-live="polite">
    <AgentAvatar />
    <div className="rounded-2xl rounded-tl-md border border-border bg-muted/60 px-5 py-4">
      <p className="font-semibold">Preparando resposta</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-strong" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
        Consultando os documentos do condomínio…
      </p>
    </div>
  </div>
);

export const SourceList = ({ sources, conversationId }: { sources: ChatSource[]; conversationId?: string }) => (
  <div className="mt-4 rounded-2xl border border-border bg-card p-4">
    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <FileText className="h-4 w-4 text-brand-strong" aria-hidden /> Fontes consultadas
    </p>
    <ul className="space-y-1">
      {sources.map((s) => {
        const params = new URLSearchParams();
        if (s.page) params.set("pagina", String(s.page));
        if (conversationId) params.set("conversa", conversationId);
        const qs = params.toString();
        return (
          <li key={`${s.document_id}:${s.page ?? ""}`}>
            <Link
              to={`/fontes/${s.document_id}${qs ? `?${qs}` : ""}`}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{s.filename}</span>
              {s.page && <span className="shrink-0 text-muted-foreground">página {s.page}</span>}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  </div>
);

interface ChatMessageProps {
  message: UiMessage;
  condoName: string;
  conversationId?: string;
  /** Reenviar pergunta que não chegou ao servidor. */
  onResend?: () => void;
  /** Refazer resposta que falhou ("erro temporário"). */
  onRetry?: () => void;
  retrying?: boolean;
  actionsDisabled?: boolean;
}

const ChatMessage = ({ message, condoName, conversationId, onResend, onRetry, retrying, actionsDisabled }: ChatMessageProps) => {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        <div
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-md border px-5 py-3",
            message.status === "failed" ? "border-danger/40 bg-danger-soft/40" : "border-primary/30 bg-brand-soft",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {message.status === "sending" ? "Enviando…" : chatTime(message.createdAt)}
          </p>
        </div>
        {message.status === "failed" && (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm text-danger" role="alert">
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" aria-hidden /> Não foi possível enviar a mensagem.
            </span>
            <button
              type="button"
              onClick={onResend}
              disabled={actionsDisabled}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline disabled:opacity-50"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden /> Reenviar
            </button>
          </div>
        )}
      </div>
    );
  }

  const title = message.outcome ? OUTCOME_TITLE[message.outcome] : undefined;
  const isError = message.outcome === "error";
  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border px-5 py-4",
          isError ? "border-danger/30 bg-danger-soft/30" : "border-border bg-muted/60",
        )}
      >
        {title && <p className="mb-1 font-bold">{title}</p>}
        <div className="prose prose-sm max-w-none break-words prose-p:my-2 prose-headings:font-display prose-strong:text-foreground">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} conversationId={conversationId} />}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={actionsDisabled || retrying}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline disabled:opacity-50"
          >
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCw className="h-3.5 w-3.5" aria-hidden />}
            Tentar novamente
          </button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {chatTime(message.createdAt)} · {condoName}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
