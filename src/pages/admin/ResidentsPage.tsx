import ResidentManagement from "@/components/admin/ResidentManagement";
import PageHeader from "@/components/app/PageHeader";
import { PageContainer } from "@/components/layout/AppShell";

const ResidentsPage = () => (
  <PageContainer>
    <PageHeader eyebrow={["Administração", "Moradores"]} title="Moradores" description="Gerencie quem tem acesso ao assistente do condomínio." />
    <ResidentManagement />
  </PageContainer>
);

export default ResidentsPage;
