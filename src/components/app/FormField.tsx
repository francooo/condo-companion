import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FormField = ({ label, htmlFor, hint, error, children, className }: FormFieldProps) => (
  <div className={cn("space-y-2", className)}>
    <Label htmlFor={htmlFor} className="text-sm font-semibold">
      {label}
    </Label>
    {children}
    {error ? (
      <p className="text-xs font-medium text-danger">{error}</p>
    ) : (
      hint && <p className="text-xs text-muted-foreground">{hint}</p>
    )}
  </div>
);

export default FormField;
