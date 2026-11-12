import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface CondoScope {
  condoId: string | null;
  condoName: string;
  /** Prefixo das rotas de gestão deste condomínio (ex.: "/admin" ou "/plataforma/condominios/:id"). */
  basePath: string;
  isPlatform: boolean;
  areaLabel: string;
  /** Valor para o parâmetro `condo_id` da API: só o administrador da plataforma precisa informar. */
  apiCondoId: string | undefined;
}

/**
 * Condomínio em gestão na tela atual. O admin do condomínio fica sempre no próprio vínculo;
 * o administrador da plataforma gere o condomínio indicado na rota `/plataforma/condominios/:condoId/...`.
 * O servidor valida o escopo de novo em cada chamada.
 */
export function useCondoScope(): CondoScope {
  const { profile } = useAuth();
  const { condoId: routeCondoId } = useParams();
  const isPlatform = profile?.role === "superadmin";

  const condos = useQuery({
    queryKey: ["condos"],
    queryFn: () => api.condos.list(),
    enabled: isPlatform && Boolean(routeCondoId),
  });

  if (isPlatform) {
    const condoId = routeCondoId ?? null;
    return {
      condoId,
      condoName: condos.data?.condos.find((c) => c.id === condoId)?.name ?? "condomínio",
      basePath: `/plataforma/condominios/${condoId}`,
      isPlatform: true,
      areaLabel: "Plataforma",
      apiCondoId: condoId ?? undefined,
    };
  }
  return {
    condoId: profile?.condo_id ?? null,
    condoName: profile?.condo_name ?? "condomínio",
    basePath: "/admin",
    isPlatform: false,
    areaLabel: "Administração",
    apiCondoId: undefined,
  };
}
