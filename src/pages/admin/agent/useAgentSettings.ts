import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type AgentReadiness, type AgentSettings } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { useCondoScope } from "@/hooks/use-condo-scope";

type Data = { settings: AgentSettings; readiness: AgentReadiness };

/** Configuração e prontidão do agente do condomínio em gestão, com a ação de liberar/retirar. */
export function useAgentSettings() {
  const scope = useCondoScope();
  const queryClient = useQueryClient();
  const queryKey = ["agent-settings", scope.condoId];

  const query = useQuery({
    queryKey,
    queryFn: () => api.agent.settings(scope.apiCondoId),
    enabled: Boolean(scope.condoId),
  });

  const setData = (data: Data) => {
    queryClient.setQueryData(queryKey, data);
    // O chat do morador lê a identidade e a disponibilidade de outra rota.
    queryClient.invalidateQueries({ queryKey: ["agent"] });
  };

  const availability = useMutation({
    mutationFn: (enabled: boolean) => api.agent.setAvailability(enabled, scope.apiCondoId),
    onSuccess: (data, enabled) => {
      setData(data);
      toast.success(enabled ? "Assistente liberado para os moradores." : "Assistente retirado dos moradores.");
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível alterar a disponibilidade.")),
  });

  return { scope, query, setData, availability, agentPath: `${scope.basePath}/agente` };
}
