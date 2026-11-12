import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type CondoDetail, type CondoInput } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { formatCnpj, formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import IconTile from "@/components/app/IconTile";
import StatusPill from "@/components/app/StatusPill";
import InlineNotice from "@/components/app/InlineNotice";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { PageContainer } from "@/components/layout/AppShell";

const EMPTY: CondoInput = { name: "", cnpj: "", address: "", city: "", state: "", description: "", contact_name: "", contact_email: "", contact_phone: "" };

const fromDetail = (c: CondoDetail): CondoInput => ({
  name: c.name,
  cnpj: c.cnpj ?? "",
  address: c.address ?? "",
  city: c.city ?? "",
  state: c.state ?? "",
  description: c.description ?? "",
  contact_name: c.contact_name ?? "",
  contact_email: c.contact_email ?? "",
  contact_phone: c.contact_phone ?? "",
});

const CondoFormPage = () => {
  const { condoId } = useParams();
  const editing = Boolean(condoId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({ queryKey: ["condo", condoId], queryFn: () => api.condos.get(condoId!), enabled: editing });

  const initial = useMemo(() => (existing.data ? fromDetail(existing.data.condo) : EMPTY), [existing.data]);
  const [form, setForm] = useState<CondoInput>(EMPTY);
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState<CondoDetail | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (existing.data) {
      setForm(fromDetail(existing.data.condo));
      setActive(existing.data.condo.status === "active");
    }
  }, [existing.data]);

  const statusChanged = editing && existing.data ? active !== (existing.data.condo.status === "active") : false;
  const dirty = !saved && (JSON.stringify(form) !== JSON.stringify(initial) || statusChanged);

  // Fechar ou recarregar a aba com alterações pendentes pede confirmação ao navegador.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const backTo = editing ? `/plataforma/condominios/${condoId}` : "/plataforma/condominios";
  const leave = () => (dirty ? setConfirmDiscard(true) : navigate(backTo));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, cnpj: form.cnpj.replace(/\D/g, "") };
      return editing ? api.condos.update(condoId!, { ...body, status: active ? "active" : "inactive" }) : api.condos.create(body);
    },
    onSuccess: ({ condo }) => {
      queryClient.invalidateQueries({ queryKey: ["condos"] });
      queryClient.setQueryData(["condo", condo.id], { condo });
      setSaved(condo);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => toast.error(errorMessage(err, "Não foi possível salvar o condomínio.")),
  });

  const set = (k: keyof CondoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      [k]: k === "cnpj" ? formatCnpj(v) : k === "contact_phone" ? formatPhone(v) : k === "state" ? v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) : v,
    }));
  };

  if (editing && existing.isError) {
    return (
      <PageContainer>
        <InlineNotice tone="danger">Condomínio não encontrado.</InlineNotice>
      </PageContainer>
    );
  }
  if (editing && !existing.data) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      </PageContainer>
    );
  }

  if (saved) {
    return (
      <PageContainer>
        <PageHeader eyebrow={["Plataforma", editing ? "Resultado de salvamento" : "Condomínio cadastrado"]} title={saved.name} />
        <SectionCard>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <IconTile icon={Check} size="lg" />
            <StatusPill tone="success">{editing ? "Alterações salvas" : "Condomínio cadastrado"}</StatusPill>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{editing ? "Cadastro atualizado" : "Ambiente criado"}</h2>
            <p className="max-w-md text-muted-foreground">
              {editing
                ? `As informações de ${saved.name} foram atualizadas.`
                : `${saved.name} já tem documentos, moradores e assistente próprios. Próximos passos: indicar o síndico e enviar os documentos.`}
            </p>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              {!editing && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSaved(null);
                    setForm(EMPTY);
                  }}
                >
                  Cadastrar outro
                </Button>
              )}
              <Button asChild>
                <Link to={`/plataforma/condominios/${saved.id}`}>Abrir condomínio</Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <button type="button" onClick={leave} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {editing ? existing.data?.condo.name : "Condomínios"}
      </button>
      <PageHeader
        eyebrow={["Plataforma", editing ? "Editar condomínio" : "Adicionar condomínio"]}
        title={editing ? "Editar condomínio" : "Cadastrar condomínio"}
        description="Cada condomínio é um ambiente independente, com documentos, moradores e assistente próprios."
      />
      {dirty && <InlineNotice tone="warning">Há alterações ainda não salvas.</InlineNotice>}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <SectionCard title="Informações do condomínio">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Nome do condomínio" htmlFor="c-name">
                <Input id="c-name" value={form.name} onChange={set("name")} required maxLength={120} placeholder="Residencial Aurora" />
              </FormField>
            </div>
            <FormField label="CNPJ" htmlFor="c-cnpj" hint="Opcional.">
              <Input id="c-cnpj" inputMode="numeric" value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0000-00" />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Descrição" htmlFor="c-desc" hint="Opcional. Ex.: condomínio residencial com 3 torres.">
                <Textarea id="c-desc" value={form.description} onChange={set("description")} maxLength={500} />
              </FormField>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Localização" description="Ajuda os moradores a encontrarem o condomínio na busca.">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
            <div className="sm:col-span-3">
              <FormField label="Endereço" htmlFor="c-address">
                <Input id="c-address" value={form.address} onChange={set("address")} placeholder="Rua e número" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Cidade" htmlFor="c-city">
                <Input id="c-city" value={form.city} onChange={set("city")} placeholder="São Paulo" />
              </FormField>
            </div>
            <FormField label="Estado" htmlFor="c-state">
              <Input id="c-state" value={form.state} onChange={set("state")} placeholder="SP" />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Contato" description="Responsável pelo condomínio junto à plataforma.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Síndico ou responsável" htmlFor="c-contact">
                <Input id="c-contact" value={form.contact_name} onChange={set("contact_name")} placeholder="Nome do responsável" />
              </FormField>
            </div>
            <FormField label="E-mail de contato" htmlFor="c-email">
              <Input id="c-email" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="contato@condominio.com" />
            </FormField>
            <FormField label="Telefone de contato" htmlFor="c-phone">
              <Input id="c-phone" type="tel" inputMode="tel" value={form.contact_phone} onChange={set("contact_phone")} placeholder="(11) 3333-4444" />
            </FormField>
          </div>
        </SectionCard>

        {editing && (
          <SectionCard title="Situação">
            <label htmlFor="c-active" className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
              <span>
                <span className="block font-semibold">Condomínio ativo</span>
                <span className="block text-sm text-muted-foreground">
                  Inativo: some da busca de novos moradores. Quem já tem vínculo continua com acesso.
                </span>
              </span>
              <Switch id="c-active" checked={active} onCheckedChange={setActive} />
            </label>
          </SectionCard>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={leave}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" disabled={save.isPending || !form.name.trim() || (editing && !dirty)}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Building2 />} {editing ? "Salvar alterações" : "Salvar condomínio"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar alterações?"
        description="As informações preenchidas e ainda não salvas serão perdidas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar"
        destructive
        onConfirm={() => navigate(backTo)}
      />
    </PageContainer>
  );
};

export default CondoFormPage;
