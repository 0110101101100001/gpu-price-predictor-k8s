import { cn } from "./utils";

export const Card = ({ children, className, ...props }) => (
  <div className={cn("metric-card", className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }) => (
  <div className={cn("flex flex-col gap-1 mb-4", className)}>{children}</div>
);

export const CardTitle = ({ children, className }) => (
  <h3 className={cn("text-xs font-semibold uppercase tracking-wider text-gray-500", className)}>{children}</h3>
);

export const CardContent = ({ children, className }) => (
  <div className={cn("", className)}>{children}</div>
);

// utilitaire simples para cn local neste arquivo (fallback)
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
