import { useEffect, useRef } from "react";
import type { CondoDocument } from "@/lib/api";
import { IN_PROGRESS, isProcessingHere, processUntilDone } from "@/lib/documents";

/** Sem atualização há este tempo, o processamento foi interrompido (aba fechada, rede caiu). */
const STALE_MS = 15_000;

/**
 * O processamento é conduzido pelo navegador em lotes. Se quem enviou saiu da página no meio,
 * quem abrir a biblioteca (ou o detalhe) retoma de onde parou.
 */
export function useResumeProcessing(docs: CondoDocument[] | undefined, onSettled: () => void) {
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    if (!docs) return;
    const now = Date.now();
    for (const d of docs) {
      if (!IN_PROGRESS.includes(d.status) || isProcessingHere(d.id)) continue;
      if (now - new Date(d.updated_at).getTime() < STALE_MS) continue;
      processUntilDone(d.id)
        .catch(() => undefined)
        .finally(() => settled.current());
    }
  }, [docs]);
}
