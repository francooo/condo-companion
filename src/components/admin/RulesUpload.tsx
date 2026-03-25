import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isAcceptedFile, getTextFromFile } from "@/lib/pdf-utils";

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
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.condo_id) return;

    if (!isAcceptedFile(file)) {
      toast.error("Formato não suportado. Use TXT ou PDF.");
      return;
    }

    setIsUploading(true);
    setUploadedCount(0);

    try {
      const text = await getTextFromFile(file);
      const chunks = chunkText(text);
      toast.info(`Processando ${chunks.length} trechos...`);

      const { data, error } = await supabase.functions.invoke("process-embeddings", {
        body: {
          chunks,
          metadata: { filename: file.name },
          condo_id: profile.condo_id,
        },
      });

      if (error) throw error;

      setUploadedCount(chunks.length);
      toast.success(`${chunks.length} trechos processados e salvos!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar: " + (err.message || "Erro desconhecido"));
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
          Faça upload de arquivos TXT com as regras do condomínio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".txt,.pdf" onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
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
