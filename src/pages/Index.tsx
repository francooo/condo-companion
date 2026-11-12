import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FullScreenLoader from "@/components/app/FullScreenLoader";
import { homePathFor } from "@/components/layout/nav";

const Index = () => {
  const { profile, loading, user } = useAuth();
  if (loading || (user && !profile)) return <FullScreenLoader />;
  return <Navigate to={homePathFor(user ? profile : null)} replace />;
};

export default Index;
