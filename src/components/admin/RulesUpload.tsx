import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isAcceptedFile, getTextFromFile } from "@/lib/pdf-utils";

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
      toast.info("Processando documento...");

      const { count } = await api.knowledgeBase.upload({ text, filename: file.name, condo_id: profile.condo_id });

      setUploadedCount(count);
      toast.success(`${count} trechos processados e salvos!`);
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
          Faça upload de arquivos TXT ou PDF com as regras do condomínio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="file" accept=".txt,.pdf" onChange={handleFileUpload} disabled={isUploading} className="cursor-pointer" />
        {isUploading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando documento com IA...
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
