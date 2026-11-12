import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";

interface CSVRow {
  Data: string;
  Categoria: string;
  "Descrição": string;
  Valor: string;
  Tipo: string;
}

const FinancialUpload = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.condo_id) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Formato não suportado. Use CSV.");
      return;
    }

    setIsUploading(true);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse<CSVRow>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) throw new Error("Erro ao ler CSV: " + parsed.errors[0].message);

      const records = parsed.data.map((row) => ({
        date: row.Data,
        category: row.Categoria,
        description: row["Descrição"] || (row as CSVRow & { Descricao?: string }).Descricao || "",
        amount: parseFloat(row.Valor?.replace(",", ".") || "0"),
        type: row.Tipo?.toLowerCase() === "receita" || row.Tipo?.toLowerCase() === "income" ? "income" : "expense",
      }));

      const { count } = await api.financial.bulkInsert(records);
      setResult({ ok: true, message: `${count} registros importados de ${file.name}.` });
      queryClient.invalidateQueries({ queryKey: ["financial"] });
    } catch (err) {
      console.error(err);
      setResult({ ok: false, message: errorMessage(err, "Erro desconhecido ao importar.") });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-muted/40 p-5 sm:flex-row sm:items-center">
        <IconTile icon={isUploading ? Loader2 : FileSpreadsheet} className={isUploading ? "[&_svg]:animate-spin" : undefined} />
        <div className="flex-1">
          <p className="font-semibold">Importar planilha CSV</p>
          <p className="text-sm text-muted-foreground">Colunas: Data, Categoria, Descrição, Valor, Tipo (receita/despesa).</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv" className="sr-only" onChange={handleFileUpload} disabled={isUploading} />
        <Button variant="outline" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? "Importando…" : "Selecionar CSV"}
        </Button>
      </div>
      {result && <InlineNotice tone={result.ok ? "success" : "danger"}>{result.message}</InlineNotice>}
    </div>
  );
};

export default FinancialUpload;
