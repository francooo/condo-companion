import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RulesUpload from "@/components/admin/RulesUpload";
import FinancialUpload from "@/components/admin/FinancialUpload";
import FinancialDashboard from "@/components/admin/FinancialDashboard";
import ResidentManagement from "@/components/admin/ResidentManagement";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Upload, BarChart3, Users } from "lucide-react";

const AdminPage = () => {
  const { profile } = useAuth();

  if (profile?.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao síndico.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">Área do Síndico</h1>
      <Tabs defaultValue="residents" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="residents" className="gap-2">
            <Users className="h-4 w-4" />
            Moradores
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <FileText className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="financial-upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="residents">
          <ResidentManagement />
        </TabsContent>
        <TabsContent value="rules">
          <RulesUpload />
        </TabsContent>
        <TabsContent value="financial-upload">
          <FinancialUpload />
        </TabsContent>
        <TabsContent value="dashboard">
          <FinancialDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
