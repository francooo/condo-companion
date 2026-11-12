import FinancialUpload from "@/components/admin/FinancialUpload";
import FinancialDashboard from "@/components/admin/FinancialDashboard";
import PageHeader from "@/components/app/PageHeader";
import { PageContainer } from "@/components/layout/AppShell";

const FinancePage = () => (
  <PageContainer>
    <PageHeader
      eyebrow={["Administração", "Financeiro"]}
      title="Financeiro"
      description="Receitas e despesas do condomínio. O assistente também usa esses dados para responder perguntas financeiras."
    />
    <FinancialUpload />
    <FinancialDashboard />
  </PageContainer>
);

export default FinancePage;
