import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

const ProfilePage = ({ area }: { area: ShellArea }) => {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nome completo" htmlFor="profile-name">
            <Input id="profile-name" value={profile.full_name ?? ""} readOnly disabled />
          </FormField>
          <FormField label="E-mail" htmlFor="profile-email">
            <Input id="profile-email" value={profile.email} readOnly disabled />
          </FormField>
        </div>
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

      <Button variant="outline" onClick={signOut}>
        <LogOut /> Sair da conta
      </Button>
    </PageContainer>
  );
};

export default ProfilePage;
