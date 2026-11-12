import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { formatPhone } from "@/lib/format";
import PasswordInput from "@/components/app/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import FormField from "@/components/app/FormField";
import CondoBadge, { condoInitials } from "@/components/app/CondoBadge";
import StatusPill from "@/components/app/StatusPill";
import { PageContainer } from "@/components/layout/AppShell";
import { AREA_LABEL, type ShellArea } from "@/components/layout/nav";

const ROLE_LABEL: Record<string, string> = {
  resident: "Morador",
  admin: "Administração do condomínio",
  superadmin: "Administração da plataforma",
};

const SCOPE_TEXT: Record<string, string> = {
  resident: "Acesso ao assistente e aos documentos deste condomínio.",
  admin: "Administração limitada a este condomínio.",
  superadmin: "Gestão de todos os condomínios da plataforma.",
};

const MIN_PASSWORD = 6;

const PasswordSection = ({ hasPassword }: { hasPassword: boolean }) => {
  const { profile, updateProfile } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) return;
    setSaving(true);
    try {
      await api.me.changePassword({ current_password: hasPassword ? form.current : undefined, new_password: form.next });
      toast.success(hasPassword ? "Senha alterada." : "Senha definida. Agora você também pode entrar com e-mail e senha.");
      setForm({ current: "", next: "", confirm: "" });
      if (profile && !hasPassword) updateProfile({ ...profile, has_password: true });
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível alterar a senha."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={hasPassword ? "Alterar senha" : "Definir senha"}
      description={hasPassword ? undefined : "Sua conta usa o Google. Defina uma senha para entrar também com e-mail."}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {hasPassword && (
          <div className="sm:col-span-2">
            <FormField label="Senha atual" htmlFor="pw-current">
              <PasswordInput id="pw-current" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
            </FormField>
          </div>
        )}
        <FormField label="Nova senha" htmlFor="pw-next" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
          <PasswordInput id="pw-next" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required minLength={MIN_PASSWORD} />
        </FormField>
        <FormField label="Confirmar nova senha" htmlFor="pw-confirm" error={mismatch ? "As senhas não coincidem." : undefined}>
          <PasswordInput id="pw-confirm" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required aria-invalid={mismatch} />
        </FormField>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving || mismatch || form.next.length < MIN_PASSWORD}>
            {saving && <Loader2 className="animate-spin" />} {hasPassword ? "Alterar senha" : "Definir senha"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
};

const ProfilePage = ({ area }: { area: ShellArea }) => {
  const { profile, signOut, updateProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);
  if (!profile) return null;

  const dirty = fullName.trim() !== (profile.full_name ?? "") || phone !== (profile.phone ?? "");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { user } = await api.me.update({ full_name: fullName.trim(), phone });
      updateProfile(user);
      toast.success("Perfil atualizado.");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível salvar o perfil."));
    } finally {
      setSaving(false);
    }
  };

  const name = profile.full_name || profile.email;
  const roleLabel = ROLE_LABEL[profile.role] ?? profile.role;

  return (
    <PageContainer>
      <PageHeader eyebrow={[AREA_LABEL[area], "Perfil"]} title="Meu perfil" description="Seus dados e o contexto do seu acesso." />

      <SectionCard title="Informações do perfil">
        <div className="mb-6 flex items-center gap-5 rounded-3xl border border-border bg-surface-warm/60 p-5">
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold">
            {condoInitials(profile.full_name || profile.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{name}</p>
            <p className="truncate text-muted-foreground">
              {roleLabel}
              {profile.condo_name ? ` · ${profile.condo_name}` : ""}
            </p>
          </div>
        </div>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome completo" htmlFor="profile-name">
            <Input id="profile-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={120} />
          </FormField>
          <FormField label="E-mail" htmlFor="profile-email" hint="Para trocar o e-mail, fale com a administração.">
            <Input id="profile-email" value={profile.email} readOnly disabled />
          </FormField>
          <FormField label="Celular" htmlFor="profile-phone">
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </FormField>
          {profile.unit && (
            <FormField label="Unidade" htmlFor="profile-unit" hint="Definida no vínculo aprovado pela administração.">
              <Input id="profile-unit" value={[profile.unit, profile.block && `Bloco ${profile.block}`].filter(Boolean).join(" · ")} readOnly disabled />
            </FormField>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!dirty || saving || fullName.trim().length < 2}>
              {saving && <Loader2 className="animate-spin" />} Salvar alterações
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Acesso e contexto">
        <div className="flex items-center gap-4">
          {profile.condo_name ? (
            <CondoBadge name={profile.condo_name} className="bg-primary" />
          ) : (
            <CondoBadge name="Plataforma" className="bg-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{profile.condo_name ?? "Todos os condomínios"}</p>
            <p className="text-sm text-muted-foreground">{SCOPE_TEXT[profile.role]}</p>
          </div>
          <StatusPill status={profile.active ? "active" : "inactive"} />
        </div>
      </SectionCard>

      <PasswordSection hasPassword={profile.has_password !== false} />

      <Button variant="outline" onClick={signOut}>
        <LogOut /> Sair da conta
      </Button>
    </PageContainer>
  );
};

export default ProfilePage;
