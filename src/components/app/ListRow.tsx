import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListRowProps {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** Mostra o chevron quando a linha é navegável. Padrão: true se houver `to`/`onClick`. */
  chevron?: boolean;
  className?: string;
}

const ListRow = ({ leading, title, meta, trailing, to, onClick, chevron, className }: ListRowProps) => {
  const interactive = Boolean(to || onClick);
  const showChevron = chevron ?? interactive;

  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold", interactive && "underline-offset-4 group-hover:underline")}>{title}</p>
        {meta && <div className="mt-0.5 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {trailing}
      {showChevron && (
        <ChevronRight
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      )}
    </>
  );

  const base = cn(
    "flex w-full items-center gap-4 py-4 text-left",
    interactive && "group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={base}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
};

/** Lista com divisores entre as linhas. */
export const ListRows = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("divide-y divide-border", className)}>{children}</div>
);

export default ListRow;
