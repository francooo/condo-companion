import ReactMarkdown from "react-markdown";
import { AlertCircle, RotateCw, Sparkles } from "lucide-react";
import IconTile from "@/components/app/IconTile";
import type { Message } from "./ChatInterface";

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const AgentAvatar = () => <IconTile icon={Sparkles} size="sm" className="mt-1 text-foreground" />;

interface ChatMessageProps {
  message: Message;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

const ChatMessage = ({ message, onRetry, retryDisabled }: ChatMessageProps) => {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-primary/30 bg-brand-soft px-5 py-3">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <p className="mt-1 text-xs text-muted-foreground">{timeFmt.format(message.createdAt)}</p>
        </div>
        {message.failed && (
          <div className="flex items-center gap-3 text-sm text-danger" role="alert">
            <AlertCircle className="h-4 w-4" />
            Não foi possível enviar.
            <button
              type="button"
              onClick={onRetry}
              disabled={retryDisabled}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline disabled:opacity-50"
            >
              <RotateCw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-border bg-muted/60 px-5 py-4">
        <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:font-display prose-strong:text-foreground">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
