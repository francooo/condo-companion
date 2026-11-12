import type { ReactNode } from "react";
import { BrandHero } from "@/components/app/Brand";

interface PublicShellProps {
  heroTagline?: string;
  heroTitle: ReactNode;
  heroDescription?: ReactNode;
  children: ReactNode;
}

/**
 * Layout das telas de entrada e acesso: painel da marca + conteúdo.
 * No mobile o painel fica acima do formulário; no desktop, à esquerda.
 */
const PublicShell = ({ heroTagline, heroTitle, heroDescription, children }: PublicShellProps) => (
  <div className="min-h-dvh bg-background">
    <div className="mx-auto grid min-h-dvh w-full max-w-6xl content-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:content-center lg:items-center lg:gap-12 lg:py-12">
      <BrandHero tagline={heroTagline} title={heroTitle} description={heroDescription} className="lg:self-stretch lg:pt-14" />
      <div className="w-full max-w-md justify-self-center lg:justify-self-start">{children}</div>
    </div>
  </div>
);

export default PublicShell;
