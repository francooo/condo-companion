import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
}

const RulesUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["text/plain", "application/pdf"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".txt")) {
      toast.error("Formato não suportado. Use PDF ou TXT.");
      return;
    }

    setIsUploading(true);
    setUploadedCount(0);

    try {
      let text = "";
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        text = await file.text();
      } else {
        toast.error("Para PDFs, converta para TXT antes do upload por enquanto.");
        setIsUploading(false);
        return;
      }

      const chunks = chunkText(text);
      toast.info(`Processando ${chunks.length} trechos...`);

      const { data, error } = await supabase.functions.invoke("process-embeddings", {
        body: {
          chunks,
          metadata: { filename: file.name },
        },
      });

      if (error) throw error;

      setUploadedCount(chunks.length);
      toast.success(`${chunks.length} trechos processados e salvos com sucesso!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar arquivo: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-gold" />
          Upload de Regras e Regimento
        </CardTitle>
        <CardDescription>
          Faça upload de arquivos TXT com as regras do condomínio. Os documentos serão processados e indexados para busca semântica.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".txt,.pdf"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="cursor-pointer"
        />
        {isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando e gerando embeddings...
          </div>
        )}
        {uploadedCount > 0 && !isUploading && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {uploadedCount} trechos salvos na base de conhecimento
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RulesUpload;
