import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RulesUpload from "@/components/admin/RulesUpload";
import FinancialUpload from "@/components/admin/FinancialUpload";
import FinancialDashboard from "@/components/admin/FinancialDashboard";
import { FileText, Upload, BarChart3 } from "lucide-react";

const AdminPage = () => {
  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">Área do Síndico</h1>
      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="rules" className="gap-2">
            <FileText className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="financial-upload" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Financeiro
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

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
