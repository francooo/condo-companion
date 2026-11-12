import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, Loader2, MessageCircle, RotateCcw, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, assetUrl, type BrandingDetail } from "@/lib/api";
import { contrastRatio, DEFAULT_PRIMARY, DEFAULT_SECONDARY, isHex, readableOn, tenantStyle } from "@/lib/color";
import { cn, errorMessage } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCondoScope } from "@/hooks/use-condo-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import IconTile from "@/components/app/IconTile";
import StatusPill from "@/components/app/StatusPill";
import InlineNotice from "@/components/app/InlineNotice";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import CondoBadge from "@/components/app/CondoBadge";
import { PageContainer } from "@/components/layout/AppShell";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Form = { display_name: string; primary_color: string; secondary_color: string };
const toForm = (b: BrandingDetail): Form => ({
  display_name: b.display_name ?? "",
  primary_color: b.primary_color ?? "",
  secondary_color: b.secondary_color ?? "",
});

const ColorField = ({ id, label, value, fallback, onChange }: { id: string; label: string; value: string; fallback: string; onChange: (v: string) => void }) => {
  const effective = isHex(value) ? value : fallback;
  const invalid = value !== "" && !isHex(value);
  return (
    <FormField label={label} htmlFor={id} error={invalid ? "Use o formato #RRGGBB." : undefined} hint={value ? undefined : `Padrão do Condo App (${fallback}).`}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: seletor`}
          value={effective.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-12 w-14 shrink-0 cursor-pointer rounded-xl border border-input bg-card p-1"
        />
        <Input id={id} value={value} placeholder={fallback} onChange={(e) => onChange(e.target.value.trim().toUpperCase())} maxLength={7} aria-invalid={invalid} />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Padrão
          </Button>
        )}
      </div>
    </FormField>
  );
};

const ImageField = ({
  label,
  hint,
  url,
  wide,
  busy,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null;
  wide?: boolean;
  busy: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const src = assetUrl(url);
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/50",
            wide ? "h-20 w-36" : "h-20 w-20",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Enviando" />
          ) : src ? (
            <img src={src} alt={`${label} atual`} className={cn("h-full w-full", wide ? "object-cover" : "object-contain")} />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={ref}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            aria-label={`Enviar ${label.toLowerCase()}`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPick(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
            {src ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {src && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 /> Remover
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
};

/** Como o app do morador fica com a identidade em edição. */
const Preview = ({ form, branding }: { form: Form; branding: BrandingDetail }) => {
  const name = form.display_name.trim() || branding.name;
  const primary = isHex(form.primary_color) ? form.primary_color : null;
  const secondary = isHex(form.secondary_color) ? form.secondary_color : null;
  return (
    <div style={tenantStyle(primary ?? DEFAULT_PRIMARY, secondary ?? DEFAULT_SECONDARY)} className="overflow-hidden rounded-3xl border border-border bg-background" aria-label="Prévia do app do morador">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">App do morador</span>
        <span className="inline-flex max-w-[60%] items-center gap-2 rounded-xl border border-border bg-card py-1 pl-1 pr-2 text-xs font-semibold">
          <CondoBadge name={name} size="sm" logoUrl={branding.logo_url} color={primary ?? DEFAULT_PRIMARY} />
          <span className="truncate">{name}</span>
        </span>
      </div>
      <div className="space-y-3 p-3">
        {branding.cover_url ? (
          <img src={assetUrl(branding.cover_url)!} alt="" className="h-24 w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-24 items-center justify-center rounded-2xl bg-tenant-secondary text-sm font-bold text-tenant-secondary-foreground">{name}</div>
        )}
        <div className="flex items-center gap-2">
          <IconTile icon={Sparkles} size="sm" className="bg-tenant/25 text-foreground" />
          <p className="text-sm font-bold">Assistente {name}</p>
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md border border-primary/30 bg-brand-soft px-3 py-2 text-xs">Qual o horário da piscina?</div>
        <div className="flex gap-2">
          <IconTile icon={MessageCircle} size="sm" className="bg-tenant/25 text-foreground" />
          <div className="rounded-2xl rounded-tl-md border border-border bg-muted/60 px-3 py-2 text-xs">A piscina funciona das 8h às 22h.</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 flex-1 rounded-xl border border-input bg-card" />
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-tenant text-tenant-foreground">
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
};

const CustomizePage = () => {
  const scope = useCondoScope();
  const { refreshProfile, profile } = useAuth();
  const queryClient = useQueryClient();
  const condoId = scope.condoId ?? "";
  const queryKey = ["branding", condoId];
  const { data, isError } = useQuery({ queryKey, queryFn: () => api.branding.get(condoId), enabled: Boolean(condoId) });
  const branding = data?.branding;
  const [form, setForm] = useState<Form | null>(null);
  const [result, setResult] = useState<"saved" | "restored" | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  // Carrega o formulário uma vez; enviar uma imagem não pode apagar o que já foi digitado.
  useEffect(() => {
    if (branding && !form) setForm(toForm(branding));
  }, [branding, form]);

  const applied = (b: BrandingDetail) => {
    queryClient.setQueryData(queryKey, { branding: b });
    queryClient.invalidateQueries({ queryKey: ["condos"] });
    // A própria barra superior do síndico mostra o logotipo do condomínio.
    if (profile?.condo_id === b.condo_id) void refreshProfile();
  };

  const save = useMutation({
    mutationFn: (f: Form) =>
      api.branding.update(condoId, { display_name: f.display_name, primary_color: f.primary_color || null, secondary_color: f.secondary_color || null }),
    onSuccess: ({ branding: b }) => {
      applied(b);
      setForm(toForm(b));
      setResult("saved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar.")),
  });

  const restore = useMutation({
    mutationFn: () => api.branding.restore(condoId),
    onSuccess: ({ branding: b }) => {
      applied(b);
      setForm(toForm(b));
      setResult("restored");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível restaurar.")),
  });

  const upload = async (slot: "logo" | "cover", file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Use uma imagem PNG, JPEG ou WebP.");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("A imagem passa de 2 MB.");
    setUploading(slot);
    try {
      applied((await api.branding.upload(condoId, slot, file)).branding);
      toast.success(slot === "logo" ? "Logotipo atualizado." : "Imagem de capa atualizada.");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível enviar a imagem."));
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (slot: "logo" | "cover") => {
    setUploading(slot);
    try {
      applied((await api.branding.removeImage(condoId, slot)).branding);
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível remover a imagem."));
    } finally {
      setUploading(null);
    }
  };

  if (isError) {
    return (
      <PageContainer>
        <InlineNotice tone="danger">Não foi possível carregar a personalização.</InlineNotice>
      </PageContainer>
    );
  }
  if (!branding || !form) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  const invalid = [form.primary_color, form.secondary_color].some((c) => c !== "" && !isHex(c));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(branding));
  const customized = Boolean(branding.display_name || branding.primary_color || branding.secondary_color || branding.logo_url || branding.cover_url);
  const primary = isHex(form.primary_color) ? form.primary_color : DEFAULT_PRIMARY;
  const textOnPrimary = readableOn(primary);
  const ratio = contrastRatio(primary, textOnPrimary);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={[scope.areaLabel, "Personalização visual"]}
        title="Personalize este condomínio"
        description={`Nome, cores e imagens que os moradores de ${scope.condoName} veem no app. A administração mantém a identidade do Condo App.`}
      />

      {result && (
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <IconTile icon={result === "saved" ? Check : RotateCcw} size="lg" />
            <StatusPill tone="success">{result === "saved" ? "Personalização salva" : "Padrão restaurado"}</StatusPill>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {result === "saved" ? "Identidade atualizada" : "Identidade padrão restaurada"}
            </h2>
            <p className="max-w-md text-muted-foreground">
              {result === "saved"
                ? `Os moradores de ${branding.display_name || branding.name} já veem a nova identidade na próxima vez que abrirem o app.`
                : "O condomínio voltou ao visual padrão do Condo App. Nome de exibição, cores e imagens foram removidos."}
            </p>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => setResult(null)}>
                Rever personalização
              </Button>
              {!scope.isPlatform && (
                <Button asChild>
                  <Link to="/chat">Ver como morador</Link>
                </Button>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <SectionCard title={`Personalização de ${branding.display_name || branding.name}`} description="As alterações se aplicam somente a este condomínio.">
            <div className="space-y-5">
              <FormField label="Nome de exibição" htmlFor="display-name" hint={`Em branco: usa o nome de cadastro ("${branding.name}").`}>
                <Input id="display-name" value={form.display_name} placeholder={branding.name} maxLength={80} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </FormField>
              <ColorField id="primary-color" label="Cor principal" value={form.primary_color} fallback={DEFAULT_PRIMARY} onChange={(v) => setForm({ ...form, primary_color: v })} />
              <p className="-mt-3 text-sm text-muted-foreground">
                Texto sobre a cor principal: {textOnPrimary === "#FFFFFF" ? "branco" : "preto"} (contraste {ratio.toFixed(1)}:1).
              </p>
              <ColorField id="secondary-color" label="Cor secundária" value={form.secondary_color} fallback={DEFAULT_SECONDARY} onChange={(v) => setForm({ ...form, secondary_color: v })} />
            </div>
          </SectionCard>

          <SectionCard title="Imagens" description="PNG, JPEG ou WebP com até 2 MB. Salvas na hora.">
            <div className="space-y-6">
              <ImageField
                label="Logotipo"
                hint="Quadrado, com fundo claro ou transparente. Aparece no selo do condomínio."
                url={branding.logo_url}
                busy={uploading === "logo"}
                onPick={(f) => upload("logo", f)}
                onRemove={() => removeImage("logo")}
              />
              <ImageField
                label="Imagem de capa"
                hint="Opcional. Horizontal, aparece no topo do chat dos moradores."
                url={branding.cover_url}
                wide
                busy={uploading === "cover"}
                onPick={(f) => upload("cover", f)}
                onRemove={() => removeImage("cover")}
              />
            </div>
          </SectionCard>

          <InlineNotice tone="info">
            Nome, saudação e ícone do assistente ficam em{" "}
            <Link className="font-semibold underline underline-offset-4" to={`${scope.basePath}/agente/configuracoes`}>
              Agente de IA
            </Link>
            .
          </InlineNotice>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" size="lg" onClick={() => setConfirmRestore(true)} disabled={!customized || restore.isPending}>
              <RotateCcw /> Restaurar padrão
            </Button>
            <Button type="submit" size="lg" disabled={!dirty || invalid || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Salvar personalização
            </Button>
          </div>
        </form>

        <div className="space-y-4 lg:sticky lg:top-24">
          <SectionCard title="Prévia" description="Como o app do morador fica com estas escolhas.">
            <Preview form={form} branding={branding} />
          </SectionCard>
          {branding.updated_at && (
            <p className="px-2 text-sm text-muted-foreground">
              Última alteração em {new Date(branding.updated_at).toLocaleDateString("pt-BR")}
              {branding.updated_by_name ? ` por ${branding.updated_by_name}` : ""}.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restaurar identidade padrão?"
        description="Nome de exibição, cores, logotipo e capa serão removidos, e o condomínio volta ao visual do Condo App. Documentos, moradores e o assistente não são alterados."
        confirmLabel="Restaurar padrão"
        destructive
        onConfirm={() => restore.mutate()}
      />
    </PageContainer>
  );
};

export default CustomizePage;
