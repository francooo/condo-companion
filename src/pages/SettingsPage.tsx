import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, type Preferences } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FilterChips from "@/components/app/FilterChips";
import CondoBadge from "@/components/app/CondoBadge";
import StatusPill from "@/components/app/StatusPill";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { PageContainer } from "@/components/layout/AppShell";

const Row = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SettingsPage = () => {
  const { profile, updateProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [confirmClear, setConfirmClear] = useState(false);
  const prefs = profile?.preferences ?? {};

  const savePrefs = useMutation({
    mutationFn: (p: Preferences) => api.me.updatePreferences(p),
    onMutate: (p) => {
      // Aplica na hora; o servidor confirma em seguida.
      if (profile) updateProfile({ ...profile, preferences: { ...prefs, ...p } });
    },
    onSuccess: ({ user }) => updateProfile(user),
    onError: (err) => {
      if (profile) updateProfile(profile);
      toast.error(errorMessage(err, "Não foi possível salvar a preferência."));
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => api.conversations.removeAll(),
    onSuccess: ({ deleted }) => {
      queryClient.removeQueries({ queryKey: ["conversation"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(deleted ? `${deleted === 1 ? "1 conversa apagada" : `${deleted} conversas apagadas`}.` : "Seu histórico já estava vazio.");
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível apagar o histórico.")),
  });

  if (!profile) return null;

  return (
    <PageContainer>
      <PageHeader eyebrow={["Morador", "Configurações"]} title="Preferências" description="Ajuste a experiência do app. As escolhas ficam salvas na sua conta." />

      <SectionCard title="Acessibilidade">
        <div className="divide-y divide-border">
          <Row title="Tamanho do texto" description="Aumenta textos e botões em todo o app.">
            <FilterChips<"normal" | "large">
              aria-label="Tamanho do texto"
              value={prefs.text_size ?? "normal"}
              onChange={(text_size) => savePrefs.mutate({ text_size })}
              options={[
                { value: "normal", label: "Padrão" },
                { value: "large", label: "Grande" },
              ]}
            />
          </Row>
          <Row title="Reduzir movimento" description="Desliga animações e transições.">
            <Switch
              aria-label="Reduzir movimento"
              checked={prefs.reduced_motion === true}
              onCheckedChange={(reduced_motion) => savePrefs.mutate({ reduced_motion })}
            />
          </Row>
        </div>
      </SectionCard>

      <SectionCard title="Privacidade">
        <Row title="Histórico de conversas" description="Suas conversas com o assistente ficam visíveis só para você.">
          <Button variant="destructive-outline" onClick={() => setConfirmClear(true)} disabled={clearHistory.isPending}>
            <Trash2 /> Apagar histórico
          </Button>
        </Row>
      </SectionCard>

      <SectionCard title="Conta">
        <div className="divide-y divide-border">
          <Link to="/perfil" className="group flex items-center gap-4 py-4">
            <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">
              <span className="block font-semibold group-hover:underline">Meu perfil</span>
              <span className="block text-sm text-muted-foreground">Nome, celular e senha</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden />
          </Link>
          <button type="button" onClick={signOut} className="group flex w-full items-center gap-4 py-4 text-left">
            <LogOut className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-semibold group-hover:underline">Sair da conta</span>
          </button>
        </div>
      </SectionCard>

      {profile.condo_name && (
        <SectionCard title="Contexto de acesso">
          <div className="flex items-center gap-4">
            <CondoBadge name={profile.condo_name} logoUrl={profile.condo_branding?.logo_url} color={profile.condo_branding?.primary_color} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{profile.condo_name}</p>
              <p className="text-sm text-muted-foreground">
                Condomínio autorizado
                {profile.unit ? ` · unidade ${profile.unit}${profile.block ? `, bloco ${profile.block}` : ""}` : ""}
              </p>
            </div>
            <StatusPill status="approved" />
          </div>
          <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Cada condomínio mantém documentos, moradores e conversas separados. Você só acessa o condomínio ao qual foi aprovado.
          </p>
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Apagar todo o histórico?"
        description={`Todas as suas conversas com o assistente de ${profile.condo_name ?? "seu condomínio"} serão apagadas. Esta ação não pode ser desfeita.`}
        confirmLabel="Apagar histórico"
        destructive
        onConfirm={() => clearHistory.mutate()}
      />
    </PageContainer>
  );
};

export default SettingsPage;
