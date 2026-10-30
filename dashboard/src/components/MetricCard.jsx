import { cn } from "./ui/utils";
import { formatCurrency } from "../utils/formatters";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Bot,
} from "lucide-react";

const ICONES = {
  bar: BarChart3,
  trending: TrendingUp,
  shield: ShieldCheck,
  bot: Bot,
};

export const MetricCard = ({
  componente,
  titulo,
  subtitulo,
  valorExibido,
  tendencia = "estavel",
  icon: IconName = BarChart3,
  variant,
}) => {
  const Icon = typeof IconName === "function" ? IconName : ICONES[IconName] || BarChart3;
  const TrendIcon = tendencia === "alta" ? ArrowUpRight : ArrowDownRight;

  const trendColor =
    tendencia === "alta" ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50";

  // Determina se o valor é percentual (contém %) ou monetário (contém R$)
  const valorStr = String(valorExibido ?? "—");
  const ehPercentual = valorStr.includes("%");
  const ehMonetario = valorStr.includes("R$");

  return (
    <div className="metric-card bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {titulo}
          </p>
          <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600">
            <Icon size={18} />
          </div>
        </div>

        <div>
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            {valorExibido !== undefined && valorExibido !== null && valorExibido !== ""
              ? valorExibido
              : "—"}
          </span>
          <p className="text-xs text-gray-500 mt-1">{subtitulo}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
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
