import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, FlaskConical, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, type AgentSettings, type AgentSettingsInput } from "@/lib/api";
import { AGENT_ICONS, AGENT_LANGUAGES, AGENT_TONES, agentIcon, DEFAULT_SUGGESTIONS, MAX_SUGGESTIONS, sameInput, toInput } from "@/lib/agent";
import { cn, errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import FilterChips from "@/components/app/FilterChips";
import IconTile from "@/components/app/IconTile";
import InlineNotice from "@/components/app/InlineNotice";
import { PageContainer } from "@/components/layout/AppShell";
import { useAgentSettings } from "./useAgentSettings";

const DEFAULT_GREETING = "Posso ajudar a encontrar informações nos documentos deste condomínio.";

/** Como o morador vê o início do chat com a configuração em edição. */
const ChatPreview = ({ form, settings }: { form: AgentSettingsInput; settings: AgentSettings }) => {
  const Icon = agentIcon(form.avatar_icon);
  const name = form.name.trim() || `Assistente ${settings.condo_name}`;
  const filled = form.suggestions.filter((s) => s.trim());
  const suggestions = filled.length ? filled : DEFAULT_SUGGESTIONS;
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card" aria-label="Prévia do chat do morador">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IconTile icon={Icon} size="sm" className="bg-gradient-to-br from-brand-soft to-primary/60 text-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{name}</p>
          <p className="text-xs text-muted-foreground">Disponível</p>
        </div>
      </div>
      <div className="space-y-3 bg-gradient-to-b from-card to-background px-4 py-5 text-center">
        <IconTile icon={Icon} className="mx-auto text-foreground" />
        <p className="text-lg font-extrabold">Olá, Marina</p>
        <p className="text-sm text-muted-foreground">
          Sou o <strong className="text-foreground">{name}</strong>. {form.greeting.trim() || DEFAULT_GREETING}
        </p>
        <ul className="space-y-2 text-left">
          {suggestions.slice(0, MAX_SUGGESTIONS).map((s, i) => {
            const SIcon = i % 2 === 0 ? Sparkles : FileText;
            return (
              <li key={`${s}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <SIcon className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden />
                {s}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const AgentSettingsPage = () => {
  const { scope, query, setData, agentPath } = useAgentSettings();
  const settings = query.data?.settings;
  const [form, setForm] = useState<AgentSettingsInput | null>(null);

  useEffect(() => {
    if (settings) setForm(toInput(settings));
  }, [settings]);

  const save = useMutation({
    mutationFn: (data: AgentSettingsInput) => api.agent.update(data, scope.apiCondoId),
    onSuccess: (data) => {
      setData(data);
      toast.success("Configuração do assistente salva.");
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar.")),
  });

  if (!settings || !form) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  const set = <K extends keyof AgentSettingsInput>(k: K, v: AgentSettingsInput[K]) => setForm({ ...form, [k]: v });
  const dirty = !sameInput(form, toInput(settings));
  const cleanSuggestions = form.suggestions.map((s) => s.trim()).filter(Boolean);
  const duplicate = new Set(cleanSuggestions.map((s) => s.toLowerCase())).size !== cleanSuggestions.length;
  const usingDefaultSuggestions = form.suggestions.length === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({ ...form, suggestions: cleanSuggestions });
  };

  return (
    <PageContainer>
      <Link to={agentPath} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Agente de IA
      </Link>
      <PageHeader
        eyebrow={[scope.areaLabel, "Configuração do agente"]}
        title="Configure seu assistente"
        description="Identidade, personalidade e sugestões que os moradores veem ao abrir o chat."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link to={`${agentPath}/teste`}>
              <FlaskConical /> Testar
            </Link>
          </Button>
        }
      />

      <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-6">
          <SectionCard title="Identidade">
            <div className="space-y-4">
              <FormField label="Nome do assistente" htmlFor="agent-name" hint={`Em branco: "Assistente ${settings.condo_name}".`}>
                <Input id="agent-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} placeholder={`Assistente ${settings.condo_name}`} />
              </FormField>
              <FormField label="Mensagem de boas-vindas" htmlFor="agent-greeting" hint="Aparece abaixo do nome, no início do chat.">
                <Textarea id="agent-greeting" value={form.greeting} onChange={(e) => set("greeting", e.target.value)} maxLength={300} placeholder={DEFAULT_GREETING} />
              </FormField>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Ícone</legend>
                <div role="radiogroup" aria-label="Ícone do assistente" className="flex flex-wrap gap-2">
                  {AGENT_ICONS.map((i) => (
                    <button
                      key={i.value}
                      type="button"
                      role="radio"
                      aria-checked={form.avatar_icon === i.value}
                      aria-label={i.label}
                      onClick={() => set("avatar_icon", i.value)}
                      className={cn(
                        "inline-flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        form.avatar_icon === i.value ? "border-primary bg-brand-soft" : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      <i.icon className="h-6 w-6" aria-hidden />
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </SectionCard>

          <SectionCard title="Personalidade e comunicação">
            <div className="space-y-4">
              <FormField label="Descrição da personalidade" htmlFor="agent-personality" hint="Opcional. Ex.: claro, acessível e responsável.">
                <Input id="agent-personality" value={form.personality} onChange={(e) => set("personality", e.target.value)} maxLength={300} />
              </FormField>
              <FormField label="Idioma das respostas" htmlFor="agent-language">
                <Select value={form.language} onValueChange={(v) => set("language", v as AgentSettingsInput["language"])}>
                  <SelectTrigger id="agent-language" className="h-12 rounded-xl bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Tom de comunicação</p>
                <FilterChips aria-label="Tom de comunicação" value={form.tone} onChange={(v) => set("tone", v)} options={AGENT_TONES} />
                <p className="text-sm text-muted-foreground">{AGENT_TONES.find((t) => t.value === form.tone)?.hint}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Sugestões iniciais"
            description={usingDefaultSuggestions ? "Usando as sugestões padrão. Adicione as suas para personalizar." : `Até ${MAX_SUGGESTIONS} perguntas que aparecem no chat vazio.`}
          >
            <div className="space-y-3">
              {form.suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label htmlFor={`sug-${i}`} className="sr-only">
                    Sugestão {i + 1}
                  </label>
                  <Input
                    id={`sug-${i}`}
                    value={s}
                    maxLength={120}
                    onChange={(e) => set("suggestions", form.suggestions.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover sugestão ${i + 1}`}
                    onClick={() => set("suggestions", form.suggestions.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              {duplicate && <p className="text-sm text-danger">Há sugestões repetidas.</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!usingDefaultSuggestions && form.suggestions.length >= MAX_SUGGESTIONS}
                  onClick={() => set("suggestions", usingDefaultSuggestions ? [...DEFAULT_SUGGESTIONS] : [...form.suggestions, ""])}
                  title={usingDefaultSuggestions ? "Começa com as sugestões padrão para você editar" : undefined}
                >
                  <Plus /> {usingDefaultSuggestions ? "Personalizar sugestões" : "Adicionar sugestão"}
                </Button>
                {!usingDefaultSuggestions && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("suggestions", [])}>
                    <RotateCcw /> Usar as sugestões padrão
                  </Button>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24">
          <SectionCard title="Prévia" description="Como os moradores veem o início do chat.">
            <ChatPreview form={form} settings={settings} />
          </SectionCard>
          <InlineNotice tone="info">
            O assistente responde somente com base nos documentos processados de {scope.condoName}, qualquer que seja a
            personalidade escolhida.
          </InlineNotice>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button type="submit" size="lg" disabled={!dirty || duplicate || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Salvar configuração
            </Button>
            <Button type="button" variant="ghost" disabled={!dirty || save.isPending} onClick={() => setForm(toInput(settings))}>
              Descartar alterações
            </Button>
          </div>
        </div>
      </form>
    </PageContainer>
  );
};

export default AgentSettingsPage;
