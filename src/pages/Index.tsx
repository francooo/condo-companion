import { Link } from "react-router-dom";
import { Building2, MessageCircle, Settings, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-navy px-4">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-gold/10 p-4">
            <Building2 className="h-16 w-16 text-gold" />
          </div>
        </div>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-primary-foreground md:text-6xl">
          Condo<span className="text-gold">Agent</span>
        </h1>
        <p className="mb-10 text-lg text-primary-foreground/70">
          Assistente inteligente para seu condomínio. Tire dúvidas sobre regras,
          regulamentos e finanças em segundos com IA.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 gap-2 text-base font-semibold px-8">
            <Link to="/chat">
              <MessageCircle className="h-5 w-5" />
              Iniciar Chat
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 text-base font-semibold border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 px-8">
            <Link to="/admin">
              <Settings className="h-5 w-5" />
              Área do Síndico
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { icon: FileText, title: "Regras e Regimento", desc: "Upload de documentos processados via IA com busca semântica" },
          { icon: BarChart3, title: "Prestação de Contas", desc: "Importação de dados financeiros com consultas precisas" },
          { icon: MessageCircle, title: "Chat Inteligente", desc: "Respostas instantâneas baseadas nos dados do condomínio" },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-primary-foreground/10 bg-navy-light p-6 text-center">
            <item.icon className="mx-auto mb-3 h-8 w-8 text-gold" />
            <h3 className="mb-2 text-lg font-semibold text-primary-foreground">{item.title}</h3>
            <p className="text-sm text-primary-foreground/60">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Index;
