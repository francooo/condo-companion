import { Link } from "react-router-dom";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/app/EmptyState";

const NotFound = () => (
  <div className="flex min-h-dvh items-center justify-center bg-background px-4">
    <EmptyState
      icon={MapPinOff}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi movido."
      action={
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  </div>
);

export default NotFound;
