import { cn } from "./ui/utils";
import { formatCurrency } from "../utils/formatters";
import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export const MetricCard = ({
  componente,
  titulo,
  subtitulo,
  valorExibido,
  tendencia = "estavel",
  icon,
  variant,
}) => {
  const TrendIcon = tendencia === "alta" ? ArrowUpRight : ArrowDownRight;

  const trendColor =
    tendencia === "alta" ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10";

  return (
    <div className="metric-card flex flex-col justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          {titulo}
        </p>

        <div>
          <span className="text-3xl font-bold text-slate-100 font-mono tracking-tight">
            {valorExibido !== undefined && valorExibido !== null && valorExibido !== ""
              ? valorExibido
              : "—"}
          </span>
          <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendIcon size={14} className={cn("rounded p-0.5", trendColor)} />
          <span className={cn("text-xs font-semibold", trendColor.split(" ")[0])}>
            {tendencia === "alta" ? "+" : ""}{tendencia}
          </span>
        </div>
      </div>
    </div>
  );
};
