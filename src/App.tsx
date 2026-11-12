import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
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
const AccessRequestsPage = lazy(() => import("./pages/admin/AccessRequestsPage"));
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import SourcePage from "./pages/SourcePage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const DocumentsPage = lazy(() => import("./pages/admin/DocumentsPage"));
const DocumentUploadPage = lazy(() => import("./pages/admin/DocumentUploadPage"));
const DocumentDetailPage = lazy(() => import("./pages/admin/DocumentDetailPage"));
const ResidentsPage = lazy(() => import("./pages/admin/ResidentsPage"));
const ResidentDetailPage = lazy(() => import("./pages/admin/ResidentDetailPage"));
const AgentPage = lazy(() => import("./pages/admin/agent/AgentPage"));
const AgentSettingsPage = lazy(() => import("./pages/admin/agent/AgentSettingsPage"));
const AgentSourcesPage = lazy(() => import("./pages/admin/agent/AgentSourcesPage"));
const AgentTestPage = lazy(() => import("./pages/admin/agent/AgentTestPage"));
const CustomizePage = lazy(() => import("./pages/admin/CustomizePage"));
const UsagePage = lazy(() => import("./pages/admin/UsagePage"));
const CondoFormPage = lazy(() => import("./pages/platform/CondoFormPage"));
const CondoDetailPage = lazy(() => import("./pages/platform/CondoDetailPage"));
const PlatformCondoLayout = lazy(() => import("./pages/platform/PlatformCondoLayout"));
const FinancePage = lazy(() => import("./pages/admin/FinancePage"));
const PlatformDashboardPage = lazy(() => import("./pages/platform/PlatformDashboardPage"));
const CondosPage = lazy(() => import("./pages/platform/CondosPage"));
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
  <Suspense fallback={<FullScreenLoader />}>
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
      <Route path="/configuracoes" element={<SettingsPage area="resident" />} />
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
      <Route path="personalizacao" element={<CustomizePage />} />
      <Route path="solicitacoes" element={<AccessRequestsPage />} />
      <Route path="financeiro" element={<FinancePage />} />
      <Route path="uso" element={<UsagePage />} />
      <Route path="configuracoes" element={<SettingsPage area="admin" />} />
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
      <Route path="condominios/novo" element={<CondoFormPage />} />
      <Route path="condominios/:condoId/editar" element={<CondoFormPage />} />
      <Route path="condominios/:condoId" element={<PlatformCondoLayout />}>
        <Route index element={<CondoDetailPage />} />
        <Route path="documentos" element={<DocumentsPage />} />
        <Route path="documentos/novo" element={<DocumentUploadPage />} />
        <Route path="documentos/:docId" element={<DocumentDetailPage />} />
        <Route path="moradores" element={<ResidentsPage />} />
        <Route path="moradores/:residentId" element={<ResidentDetailPage />} />
        <Route path="agente" element={<AgentPage />} />
        <Route path="agente/configuracoes" element={<AgentSettingsPage />} />
        <Route path="agente/fontes" element={<AgentSourcesPage />} />
        <Route path="agente/teste" element={<AgentTestPage />} />
        <Route path="personalizacao" element={<CustomizePage />} />
      </Route>
      <Route path="solicitacoes" element={<AccessRequestsPage />} />
      <Route path="uso" element={<UsagePage />} />
      <Route path="configuracoes" element={<SettingsPage area="platform" />} />
      <Route path="perfil" element={<ProfilePage area="platform" />} />
    </Route>

    {/* Rotas antigas */}
    <Route path="/superadmin" element={<Navigate to="/plataforma" replace />} />
    <Route path="/select-condo" element={<Navigate to="/vinculo" replace />} />

    <Route path="*" element={<NotFound />} />
  </Routes>
  </Suspense>
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
