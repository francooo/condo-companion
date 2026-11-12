import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { isAcceptedFile, getTextFromFile } from "@/lib/pdf-utils";
import { Button } from "@/components/ui/button";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import { cn, errorMessage } from "@/lib/utils";

interface RulesUploadProps {
  /** Obrigatório para o administrador da plataforma; o admin do condomínio usa o próprio vínculo. */
  condoId?: string;
  onUploaded?: (count: number) => void;
}

/** Área de envio de documentos (PDF/TXT) para a base de conhecimento do agente. */
const RulesUpload = ({ condoId, onUploaded }: RulesUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; filename: string; count?: number; error?: string } | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error("Formato não suportado. Use PDF ou TXT.");
      return;
    }
    setIsUploading(true);
    setResult(null);
    try {
      const text = await getTextFromFile(file);
      const { count } = await api.knowledgeBase.upload({ text, filename: file.name, condo_id: condoId });
      setResult({ ok: true, filename: file.name, count });
      onUploaded?.(count);
    } catch (err) {
      console.error(err);
      setResult({ ok: false, filename: file.name, error: errorMessage(err) });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-primary bg-brand-soft/50" : "border-border bg-muted/40",
        )}
      >
        <IconTile icon={isUploading ? Loader2 : FileUp} size="lg" className={isUploading ? "[&_svg]:animate-spin" : undefined} />
        <p className="font-semibold">{isUploading ? "Processando documento com IA…" : "Arraste um arquivo ou selecione do dispositivo"}</p>
        <p className="text-sm text-muted-foreground">PDF ou TXT · o texto é extraído e indexado para o assistente.</p>
        <input ref={inputRef} type="file" accept=".txt,.pdf" className="sr-only" id="rules-file" onChange={(e) => upload(e.target.files?.[0])} disabled={isUploading} />
        <Button type="button" variant="outline" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          Selecionar arquivo
        </Button>
      </div>

      {result?.ok && (
        <InlineNotice tone="success">
          <strong>{result.filename}</strong> processado: {result.count} trechos adicionados à base de conhecimento.
        </InlineNotice>
      )}
      {result && !result.ok && (
        <InlineNotice tone="danger">
          Não foi possível processar <strong>{result.filename}</strong>. {result.error}
        </InlineNotice>
      )}
    </div>
  );
};

export default RulesUpload;
