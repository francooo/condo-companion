import { useAuth } from "@/contexts/AuthContext";
import RulesUpload from "@/components/admin/RulesUpload";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";

const DocumentsPage = () => {
  const { profile } = useAuth();
  const condo = profile?.condo_name ?? "condomínio";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={["Administração", "Documentos"]}
        title="Documentos do condomínio"
        description="Biblioteca da base de conhecimento do condomínio ativo."
      />
      <SectionCard title="Adicionar documento" description={`Os documentos ficam disponíveis somente ao assistente do ${condo}.`}>
        <RulesUpload />
      </SectionCard>
      <InlineNotice tone="info">
        Envie convenção, regimento interno, atas, comunicados, regulamentos e manuais. Só os documentos processados
        fundamentam as respostas do assistente.
      </InlineNotice>
    </PageContainer>
  );
};

export default DocumentsPage;
