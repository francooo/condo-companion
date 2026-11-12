import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import IconTile from "@/components/app/IconTile";
import { PageContainer } from "@/components/layout/AppShell";

const FAQ = [
  {
    q: "Como solicito acesso ao condomínio?",
    a: "Crie sua conta, busque o condomínio pelo nome ou endereço e informe sua unidade. A administração do condomínio analisa o pedido; você acompanha a situação pelo app.",
  },
  {
    q: "De onde vêm as respostas?",
    a: "O assistente responde com base nos documentos que a administração do seu condomínio disponibilizou, como convenção, regimento interno, atas e comunicados.",
  },
  {
    q: "E se o assistente não encontrar a informação?",
    a: "Ele avisa quando a informação não consta nos documentos disponíveis. Nesse caso, procure a administração do condomínio.",
  },
  {
    q: "Posso consultar de onde veio uma resposta?",
    a: "Sim. Quando a resposta vem de um documento, ela mostra as fontes consultadas. Toque na fonte para ver a página do documento.",
  },
  {
    q: "Minhas conversas ficam salvas?",
    a: "Sim, no Histórico, e só você as vê. Você pode apagar uma conversa pelo menu dela ou todo o histórico em Configurações.",
  },
  {
    q: "Posso ver outro condomínio?",
    a: "Não. Você só acessa o condomínio ao qual está vinculado. Cada condomínio tem documentos e conversas independentes.",
  },
];

const HelpPage = () => (
  <PageContainer>
    <PageHeader eyebrow={["Morador", "Ajuda"]} title="Como podemos ajudar?" description="Respostas sobre acesso, vínculo e uso do assistente." />

    <SectionCard title="Perguntas frequentes" description="Informação clara para você se orientar.">
      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-left font-semibold hover:no-underline">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SectionCard>

    <SectionCard title="Precisa de ajuda com seu vínculo?">
      <div className="space-y-3">
        <IconTile icon={HelpCircle} size="lg" />
        <h3 className="text-xl font-bold">Fale com a administração</h3>
        <p className="text-muted-foreground">
          Para confirmar unidade, acesso ou documentos do condomínio, entre em contato com a administração ou o síndico.
        </p>
      </div>
    </SectionCard>
  </PageContainer>
);

export default HelpPage;
