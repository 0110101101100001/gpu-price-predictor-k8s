import { Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { cn } from "./ui/utils";

const MOCK_RANKING = [
  { id: "mock-1", nome: "RTX 5060", loja: "Pichau", preco: 2599.90, variacao: -4.2, tendencia: "baixa" },
  { id: "mock-2", nome: "RTX 5050", loja: "Pichau", preco: 2199.00, variacao: 2.8, tendencia: "alta" },
  { id: "mock-3", nome: "RX 7600", loja: "Pichau", preco: 1699.90, variacao: -1.5, tendencia: "estavel" },
];

export const RankingPanel = ({ componente, componentes = [] }) => {
  const lista = componentes.length > 0 ? componentes : MOCK_RANKING;

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/50 shadow-2xl rounded-2xl p-6 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-6 pb-4 border-b border-slate-800/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Trophy size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-100 leading-snug truncate">Ranking de Ofertas</h2>
            <p className="text-xs text-slate-500 truncate">Oportunidades do Supabase</p>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex flex-col gap-2">
          {lista.map((item) => {
            const isBaixa = item.tendencia === "baixa";
            const isAlta = item.tendencia === "alta";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors border border-slate-700/40 gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-700/50 shrink-0">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${item.loja.toLowerCase().replace(/\s/g, "")}.com.br&sz=128`}
                      alt={item.loja}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 2L1 21h22L12 2z'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 truncate">{item.loja}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-100 font-mono">{formatCurrency(item.preco)}</p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <div
                      className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold",
                        isBaixa
                          ? "text-emerald-400 bg-emerald-500/10"
                          : isAlta
                            ? "text-rose-400 bg-rose-500/10"
                            : "text-slate-500 bg-slate-800/50"
                      )}
                    >
                      {isBaixa ? (
                        <TrendingDown size={12} />
                      ) : isAlta ? (
                        <TrendingUp size={12} />
                      ) : (
                        <Minus size={12} />
                      )}
                      <span>{item.variacao.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
