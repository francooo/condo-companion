import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppShell from "@/components/layout/AppShell";
import { hasApprovedAccess, homePathFor } from "@/components/layout/nav";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import WelcomePage from "./pages/WelcomePage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FindCondoPage from "./pages/onboarding/FindCondoPage";
import LinkConfirmPage from "./pages/onboarding/LinkConfirmPage";
import MembershipStatusPage from "./pages/onboarding/MembershipStatusPage";
import AccessRequestsPage from "./pages/admin/AccessRequestsPage";
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import SourcePage from "./pages/SourcePage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import DocumentsPage from "./pages/admin/DocumentsPage";
import DocumentUploadPage from "./pages/admin/DocumentUploadPage";
import DocumentDetailPage from "./pages/admin/DocumentDetailPage";
import ResidentsPage from "./pages/admin/ResidentsPage";
import ResidentDetailPage from "./pages/admin/ResidentDetailPage";
import AgentPage from "./pages/admin/agent/AgentPage";
import AgentSettingsPage from "./pages/admin/agent/AgentSettingsPage";
import AgentSourcesPage from "./pages/admin/agent/AgentSourcesPage";
import AgentTestPage from "./pages/admin/agent/AgentTestPage";
import FinancePage from "./pages/admin/FinancePage";
import PlatformDashboardPage from "./pages/platform/PlatformDashboardPage";
import CondosPage from "./pages/platform/CondosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // Aguarda o perfil antes de checar papéis
  if (allowedRoles && !profile) return <FullScreenLoader />;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />;
  // Sem vínculo aprovado: volta para a busca ou para a situação da solicitação
  if (profile && !hasApprovedAccess(profile)) return <Navigate to={homePathFor(profile)} replace />;

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/boas-vindas" element={<WelcomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/cadastro" element={<SignupPage />} />
    <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
    <Route path="/redefinir-senha/:token" element={<ResetPasswordPage />} />
    <Route path="/setup" element={<SetupPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />

    {/* Vínculo com o condomínio */}
    <Route path="/vinculo" element={<FindCondoPage />} />
    <Route path="/vinculo/status" element={<MembershipStatusPage />} />
    <Route path="/vinculo/:condoId" element={<LinkConfirmPage />} />

    {/* Morador */}
    <Route
      element={
        <ProtectedRoute allowedRoles={["resident", "admin"]}>
          <AppShell area="resident" />
        </ProtectedRoute>
      }
    >
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:conversationId" element={<ChatPage />} />
      <Route path="/historico" element={<HistoryPage />} />
      <Route path="/fontes/:documentId" element={<SourcePage />} />
      <Route path="/configuracoes" element={<SettingsPage />} />
      <Route path="/ajuda" element={<HelpPage />} />
      <Route path="/perfil" element={<ProfilePage area="resident" />} />
    </Route>

    {/* Administração do condomínio */}
    <Route
      path="/admin"
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <AppShell area="admin" />
        </ProtectedRoute>
      }
    >
      <Route index element={<AdminDashboardPage />} />
      <Route path="documentos" element={<DocumentsPage />} />
      <Route path="documentos/novo" element={<DocumentUploadPage />} />
      <Route path="documentos/:docId" element={<DocumentDetailPage />} />
      <Route path="moradores" element={<ResidentsPage />} />
      <Route path="moradores/:residentId" element={<ResidentDetailPage />} />
      <Route path="agente" element={<AgentPage />} />
      <Route path="agente/configuracoes" element={<AgentSettingsPage />} />
      <Route path="agente/fontes" element={<AgentSourcesPage />} />
      <Route path="agente/teste" element={<AgentTestPage />} />
      <Route path="solicitacoes" element={<AccessRequestsPage />} />
      <Route path="financeiro" element={<FinancePage />} />
      <Route path="perfil" element={<ProfilePage area="admin" />} />
    </Route>

    {/* Administração da plataforma */}
    <Route
      path="/plataforma"
      element={
        <ProtectedRoute allowedRoles={["superadmin"]}>
          <AppShell area="platform" />
        </ProtectedRoute>
      }
    >
      <Route index element={<PlatformDashboardPage />} />
      <Route path="condominios" element={<CondosPage />} />
      <Route path="condominios/:condoId/documentos" element={<DocumentsPage />} />
      <Route path="condominios/:condoId/documentos/novo" element={<DocumentUploadPage />} />
      <Route path="condominios/:condoId/documentos/:docId" element={<DocumentDetailPage />} />
      <Route path="condominios/:condoId/moradores" element={<ResidentsPage />} />
      <Route path="condominios/:condoId/moradores/:residentId" element={<ResidentDetailPage />} />
      <Route path="condominios/:condoId/agente" element={<AgentPage />} />
      <Route path="condominios/:condoId/agente/configuracoes" element={<AgentSettingsPage />} />
      <Route path="condominios/:condoId/agente/fontes" element={<AgentSourcesPage />} />
      <Route path="condominios/:condoId/agente/teste" element={<AgentTestPage />} />
      <Route path="solicitacoes" element={<AccessRequestsPage />} />
      <Route path="perfil" element={<ProfilePage area="platform" />} />
    </Route>

    {/* Rotas antigas */}
    <Route path="/superadmin" element={<Navigate to="/plataforma" replace />} />
    <Route path="/select-condo" element={<Navigate to="/vinculo" replace />} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
