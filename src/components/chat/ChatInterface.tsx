import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ChatMessage from "./ChatMessage";
import { toast } from "sonner";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ask-condo-agent", {
        body: { question: text, history: messages },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: "assistant", content: data.answer || "Desculpe, não consegui gerar uma resposta." }]);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao consultar o agente: " + (err.message || "Erro desconhecido"));
      setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-2xl bg-gold/10 p-4">
                <Building2 className="h-12 w-12 text-gold" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Olá! Sou o CondoAgent</h2>
              <p className="max-w-sm text-muted-foreground">
                Pergunte sobre regras do condomínio, regulamentos ou informações financeiras.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Digitando...</span>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card px-4 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="mx-auto flex max-w-2xl gap-2"
        >
          <Input
            placeholder="Pergunte sobre regras ou finanças do condomínio..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
