import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface CSVRow {
  Data: string;
  Categoria: string;
  "Descrição": string;
  Valor: string;
  Tipo: string;
}

const FinancialUpload = () => {
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.condo_id) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Formato não suportado. Use CSV.");
      return;
    }

    setIsUploading(true);
    setUploadedCount(0);

    try {
      const text = await file.text();
      const result = Papa.parse<CSVRow>(text, { header: true, skipEmptyLines: true });

      if (result.errors.length > 0) {
        toast.error("Erro ao ler CSV: " + result.errors[0].message);
        setIsUploading(false);
        return;
      }

      const records = result.data.map((row) => ({
        date: row.Data,
        category: row.Categoria,
        description: row["Descrição"] || (row as any).Descricao || "",
        amount: parseFloat(row.Valor?.replace(",", ".") || "0"),
        type: row.Tipo?.toLowerCase() === "receita" || row.Tipo?.toLowerCase() === "income" ? "income" : "expense",
        condo_id: profile.condo_id,
      }));

      const { error } = await supabase.from("financial_records").insert(records);
      if (error) throw error;

      setUploadedCount(records.length);
      toast.success(`${records.length} registros importados!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao importar: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-gold" />
          Upload Financeiro
        </CardTitle>
        <CardDescription>
          Importe um CSV com: Data, Categoria, Descrição, Valor, Tipo (receita/despesa).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
        {isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando registros...
          </div>
        )}
        {uploadedCount > 0 && !isUploading && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {uploadedCount} registros importados com sucesso
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialUpload;
