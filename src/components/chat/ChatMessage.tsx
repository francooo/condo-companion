import ReactMarkdown from "react-markdown";
import { Building2, User } from "lucide-react";
import type { Message } from "./ChatInterface";

const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-primary" : "bg-gold/10"}`}>
        {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Building2 className="h-4 w-4 text-gold" />}
      </div>
      <div className={`max-w-[80%] px-4 py-3 ${isUser ? "chat-bubble-user" : "chat-bubble-agent"}`}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
