import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppShell from "@/components/layout/AppShell";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import SelectCondoPage from "./pages/SelectCondoPage";
import ChatPage from "./pages/ChatPage";
import HelpPage from "./pages/HelpPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import DocumentsPage from "./pages/admin/DocumentsPage";
import ResidentsPage from "./pages/admin/ResidentsPage";
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
  // Morador/admin sem condomínio vinculado precisa passar pelo vínculo
  if (profile && profile.role !== "superadmin" && !profile.condo_id) return <Navigate to="/vinculo" replace />;

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/setup" element={<SetupPage />} />
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/vinculo" element={<SelectCondoPage />} />

    {/* Morador */}
    <Route
      element={
        <ProtectedRoute allowedRoles={["resident", "admin"]}>
          <AppShell area="resident" />
        </ProtectedRoute>
      }
    >
      <Route path="/chat" element={<ChatPage />} />
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
      <Route path="moradores" element={<ResidentsPage />} />
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
