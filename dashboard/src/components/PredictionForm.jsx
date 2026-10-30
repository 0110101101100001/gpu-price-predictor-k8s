import { useState, useEffect } from "react";
import { Zap, Brain, ShieldAlert, RefreshCw } from "lucide-react";
import { predict } from "../utils/api";
import { fetchPrecoRecentePorComponente } from "../lib/supabase";
import { cn } from "./ui/utils";
import { formatCurrency } from "../utils/formatters";

export const PredictionForm = ({ componenteSelecionado = "RTX 5060", className }) => {
  const [preco, setPreco] = useState("");
  const [mediaMovelAtual, setMediaMovelAtual] = useState("");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [carregandoValores, setCarregandoValores] = useState(false);

  // Carrega o último preço registrado da placa ao montar ou mudar a placa
  useEffect(() => {
    let cancelado = false;

    async function carregarUltimoValor() {
      if (!componenteSelecionado) return;
      setCarregandoValores(true);
      try {
        const registro = await fetchPrecoRecentePorComponente(componenteSelecionado);
        if (!cancelado && registro) {
          setPreco(registro.preco.toFixed(2));
        }
      } catch (err) {
        if (!cancelado) {
          console.warn("Não foi possível carregar o último valor:", err);
        }
      } finally {
        if (!cancelado) {
          setCarregandoValores(false);
        }
      }
    }

    carregarUltimoValor();

    return () => {
      cancelado = true;
    };
  }, [componenteSelecionado]);

  // Calcula variação estimada com base no último valor vs preço informado
  const variacaoEstimada = preco && mediaMovelAtual > 0
    ? ((preco - mediaMovelAtual) / mediaMovelAtual) * 100
    : 0;

  // Armazena o último valor conhecido para referência interna
  useEffect(() => {
    let cancelado = false;
    async function carregarMediaMovel() {
      if (!componenteSelecionado) return;
      try {
        const registro = await fetchPrecoRecentePorComponente(componenteSelecionado);
        if (!cancelado && registro) {
          setMediaMovelAtual(registro.preco);
        }
      } catch (err) {
        if (!cancelado) {
          console.warn("Não foi possível carregar média móvel:", err);
        }
      }
    }
    carregarMediaMovel();
    return () => { cancelado = true; };
  }, [componenteSelecionado]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        preco: parseFloat(preco),
        media_movel_7d: mediaMovelAtual || parseFloat(preco),
        variacao_percentual: mediaMovelAtual > 0 && preco
          ? ((parseFloat(preco) - mediaMovelAtual) / mediaMovelAtual) * 100
          : 0,
      };
      const resultadoApi = await predict(payload);
      setResultado({ recomendacao: resultadoApi.recomendacao, payload });
    } catch (err) {
      setError(err.message || "Erro ao consultar o modelo preditivo");
    } finally {
      setLoading(false);
    }
  };

  const estaComprando = resultado?.recomendacao === "Comprar Agora";

  return (
    <div className={cn("chart-container bg-white p-6 rounded-2xl shadow-sm border border-gray-100", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <Brain size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Teste de Predição</h2>
            <p className="text-sm text-gray-500">
              Simule o preço de oferta para{" "}
              <span className="font-medium">{componenteSelecionado}</span>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-3">
          <label className="block text-sm font-medium text-gray-700">
            Preço de oferta (R$)
          </label>
          <input
            type="number"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            className="input-field"
            placeholder="Ex: 2599,90"
            disabled={carregandoValores}
          />
          {carregandoValores && (
            <p className="text-xs text-gray-400">Carregando último valor…</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || carregandoValores}
          className="w-full py-3 rounded-xl text-white font-medium shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-blue-600"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Processando…
            </>
          ) : (
            "Obter recomendação"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm flex items-center gap-3">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Resultado da predição — cartão minimalista */}
      {resultado && (
        <div className="mt-6 p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          {/* Barra de status lateral discreta */}
          <div className={cn(
            "w-2 rounded-lg self-start mt-0.5",
            estaComprando ? "bg-emerald-500" : "bg-amber-500"
          )} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className={cn(estaComprando ? "text-emerald-500" : "text-amber-500")} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Recomendação da IA
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-3xl font-bold tracking-tight",
                estaComprando ? "text-emerald-600" : "text-amber-600"
              )}>
                {resultado.recomendacao}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Com base no preço de oferta e na média móvel de 7 dias
            </p>
            <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 font-mono flex gap-4">
              <span>Preço: {formatCurrency(resultado.payload.preco)}</span>
              <span>MM7d: {formatCurrency(resultado.payload.media_movel_7d)}</span>
              <span>Var: {resultado.payload.variacao_percentual.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
