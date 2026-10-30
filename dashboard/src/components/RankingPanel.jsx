import { Trophy, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { cn } from "./ui/utils";

export const RankingPanel = ({ componente, componentes = [] }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      {/* Cabeçalho do Bloco */}
      <div className="flex items-start justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Trophy size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-snug truncate">Ranking de Ofertas</h2>
            <p className="text-xs text-gray-400 truncate">Oportunidades do Supabase</p>
          </div>
        </div>
      </div>

      {/* Lista de Ofertas */}
      <div className="flex-1">
        {componentes.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-center text-gray-400 text-sm">
            Nenhum dado disponível para ranking.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {componentes.map((item) => {
              const isBaixa = item.tendencia === "baixa";
              const isAlta = item.tendencia === "alta";

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50/60 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100/60 gap-2"
                >
                  {/* Componente e Loja */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0">
                      {item.nome.split(" ")[0][0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {item.nome}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{item.loja}</p>
                    </div>
                  </div>

                  {/* Preço e Variação alinhados à direita */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      {item.preco > 0 ? formatCurrency(item.preco) : "—"}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <div
                        className={cn(
                          "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold",
                          isBaixa
                            ? "text-emerald-600 bg-emerald-50"
                            : isAlta
                            ? "text-rose-600 bg-rose-50"
                            : "text-gray-600 bg-gray-100"
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
        )}
      </div>
    </div>
  );
};