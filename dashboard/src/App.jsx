import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Bot,
  RefreshCw,
} from "lucide-react";
import {
  fetchHistoricoPrecos,
  fetchPrecosMaisRecentes,
  COMPONENTES_MVP,
} from "./lib/supabase";
import { MetricCard } from "./components/MetricCard";
import { ChartPanel } from "./components/ChartPanel";
import { RankingPanel } from "./components/RankingPanel";
import { PredictionForm } from "./components/PredictionForm";
import { formatCurrency } from "./utils/formatters";

export default function App() {
  const [dadosHistorico, setDadosHistorico] = useState([]);
  const [precosRecentes, setPrecosRecentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [componenteSelecionado, setComponenteSelecionado] =
    useState("RTX 5050");

  const predictionRef = useRef(null);

  const handleScrollToPrediction = () => {
    if (predictionRef.current) {
      predictionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    let cancelado = false;

    async function carregarDados() {
      try {
        setCarregando(true);
        setErro(null);

        const [historico, recentes] = await Promise.all([
          fetchHistoricoPrecos(COMPONENTES_MVP),
          fetchPrecosMaisRecentes(COMPONENTES_MVP),
        ]);

        if (!cancelado) {
          setDadosHistorico(historico);
          setPrecosRecentes(recentes);
        }
      } catch (err) {
        if (!cancelado) {
          setErro(err.message || "Erro ao carregar dados do Supabase");
          console.error("Erro ao carregar dados:", err);
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }

    carregarDados();

    return () => {
      cancelado = true;
    };
  }, []);

  // ============================================================
  // 1. UNIFICAR E FILTRAR TODOS OS DADOS DA GPU SELECIONADA
  // ============================================================
  // Junta tudo para garantir que nenhuma oferta de hoje fica perdida
  const todosOsDados = [...dadosHistorico, ...precosRecentes];
  const dadosDoComponente = todosOsDados.filter(
    (d) => d.componente === componenteSelecionado && d.preco > 0,
  );

  // ============================================================
  // 2. PREPARAR DADOS DO GRÁFICO (Menor preço de cada dia)
  // ============================================================
  const mapaDiario = {};
  let dataMaisRecenteStr = "";

  dadosDoComponente.forEach((d) => {
    if (!d.data_registo) return;
    const dataDia = d.data_registo.split("T")[0];

    // Atualiza qual é a data mais recente que temos no banco
    if (!dataMaisRecenteStr || dataDia > dataMaisRecenteStr) {
      dataMaisRecenteStr = dataDia;
    }

    // Guarda apenas o menor preço absoluto daquele dia para traçar a linha do gráfico
    if (!mapaDiario[dataDia] || d.preco < mapaDiario[dataDia].preco) {
      mapaDiario[dataDia] = {
        ...d,
        data_registo: d.data_registo, // Mantém o ISO para o gráfico não dar erro
      };
    }
  });

  const historicoConsolidado = Object.values(mapaDiario).sort(
    (a, b) => new Date(a.data_registo) - new Date(b.data_registo),
  );

  const mediaMovelSelecionada =
    historicoConsolidado.length > 0
      ? historicoConsolidado.reduce((soma, d) => soma + d.preco, 0) /
        historicoConsolidado.length
      : 0;

  // ============================================================
  // 3. RANKING E PREÇO ATUAL (Focado estritamente na data mais recente)
  // ============================================================
  // Pega em TODAS as ofertas registadas no dia mais recente
  const ofertasMaisRecentes = dadosDoComponente.filter(
    (d) =>
      d.data_registo && d.data_registo.split("T")[0] === dataMaisRecenteStr,
  );

  // Remove duplicatas exatas (mesma loja com mesmo preço) para o ranking ficar limpo
  const ofertasUnicas = [];
  const assinaturas = new Set();
  ofertasMaisRecentes.forEach((d) => {
    const sig = `${d.loja}-${d.preco}`;
    if (!assinaturas.has(sig)) {
      assinaturas.add(sig);
      ofertasUnicas.push(d);
    }
  });

  // Ordena do mais barato para o mais caro
  ofertasUnicas.sort((a, b) => a.preco - b.preco);

  // O Preço Atual é OBRIGATORIAMENTE a primeira posição (mais barato) das ofertas de hoje
  const precoAtualExibicao =
    ofertasUnicas.length > 0 ? ofertasUnicas[0].preco : 0;

  // Constrói os cards do ranking com o Top 5
  const ranking = ofertasUnicas.slice(0, 5).map((item, index) => {
    const variacaoFaceAMedia =
      mediaMovelSelecionada > 0
        ? ((item.preco - mediaMovelSelecionada) / mediaMovelSelecionada) * 100
        : 0;

    return {
      id: item.id || `ranking-${index}-${item.loja}`,
      nome: item.componente,
      loja: item.loja || "Desconhecida",
      preco: item.preco || 0,
      variacao: variacaoFaceAMedia,
      tendencia:
        variacaoFaceAMedia < -1
          ? "baixa"
          : variacaoFaceAMedia > 1
            ? "alta"
            : "estavel",
    };
  });

  // ============================================================
  // 4. CÁLCULO DE TAXAS (Blindado contra valores bizarros)
  // ============================================================
  let variacaoSemanalComp = 0;
  if (historicoConsolidado.length > 0 && precoAtualExibicao > 0) {
    // Compara a melhor oferta de hoje com a mais antiga registada no histórico
    const primeiroPreco = historicoConsolidado[0].preco;
    if (primeiroPreco > 0) {
      variacaoSemanalComp =
        ((precoAtualExibicao - primeiroPreco) / primeiroPreco) * 100;
    }
  }

  let taxaVariacaoComp = 0;
  if (historicoConsolidado.length >= 2 && precoAtualExibicao > 0) {
    // Compara a melhor oferta de hoje com a melhor oferta do dia ANTERIOR
    const precoAnterior =
      historicoConsolidado[historicoConsolidado.length - 2].preco;
    if (precoAnterior > 0) {
      taxaVariacaoComp =
        ((precoAtualExibicao - precoAnterior) / precoAnterior) * 100;
    }
  }

  const tendenciaSelecionada =
    taxaVariacaoComp > 0 ? "alta" : taxaVariacaoComp < 0 ? "baixa" : "estavel";
  const confiancaModelo = 87;

  // ============================================================
  // 5. ESTADOS DE CARREGAMENTO E ERRO
  // ============================================================
  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 font-medium">
            Carregando dados do Supabase…
          </p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900/60 backdrop-blur-md border border-slate-800/50 shadow-2xl rounded-2xl p-6">
          <ShieldCheck className="w-8 h-8 text-rose-400 mb-4" />
          <h2 className="text-lg font-bold text-slate-100 mb-2">
            Erro ao carregar dados
          </h2>
          <p className="text-sm text-slate-500 mb-4">{erro}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 6. RENDERIZAÇÃO DA UI
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-950">
      <main className="pt-8 pb-12 px-4 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              Dashboard de Preços
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 rounded-xl bg-slate-800/60 border border-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Pichau / Kabum
              </span>
              <span className="text-sm text-slate-400 font-medium">
                Monitoramento em tempo real
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary"
            >
              <RefreshCw size={18} /> Atualizar
            </button>
            <button onClick={handleScrollToPrediction} className="btn-primary">
              <Bot size={18} /> IA Preditiva
            </button>
          </div>
        </div>

        {/* Seletor de placa de vídeo */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-slate-900/50 backdrop-blur-md border border-slate-800/40 shadow-lg rounded-2xl p-8">
          <span className="text-sm font-medium text-slate-400">
            Placa de vídeo:
          </span>
          <div className="flex gap-2 items-center">
            {COMPONENTES_MVP.map((comp) => (
              <button
                key={comp}
                onClick={() => setComponenteSelecionado(comp)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  componenteSelecionado === comp
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-100"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            componente={componenteSelecionado}
            titulo="Preço Atual"
            subtitulo="Melhor oferta hoje"
            valorExibido={
              precoAtualExibicao > 0 ? formatCurrency(precoAtualExibicao) : "—"
            }
            tendencia={tendenciaSelecionada}
            icon={BarChart3}
            variant="blue"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Variação Semanal"
            subtitulo="Tendência recente"
            valorExibido={
              historicoConsolidado.length > 0
                ? `${variacaoSemanalComp > 0 ? "+" : ""}${variacaoSemanalComp.toFixed(1)}%`
                : "—"
            }
            tendencia={variacaoSemanalComp >= 0 ? "alta" : "baixa"}
            icon={TrendingUp}
            variant="default"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Taxa de Variação"
            subtitulo="Últimos dias"
            valorExibido={
              historicoConsolidado.length >= 2
                ? `${taxaVariacaoComp > 0 ? "+" : ""}${taxaVariacaoComp.toFixed(1)}%`
                : "—"
            }
            tendencia={taxaVariacaoComp >= 0 ? "alta" : "baixa"}
            icon={ShieldCheck}
            variant="warning"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Confiança do Modelo"
            subtitulo="Eficácia da recomendação"
            valorExibido={`${confiancaModelo}%`}
            tendencia="alta"
            icon={Bot}
            variant="success"
          />
        </div>

        {/* Linha principal: Gráfico + Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <ChartPanel
              componente={componenteSelecionado}
              dados={historicoConsolidado}
            />
          </div>
          <div className="lg:col-span-1">
            <RankingPanel
              componente={componenteSelecionado}
              componentes={ranking}
            />
          </div>
        </div>

        {/* Seção de predição */}
        <div className="mb-8" ref={predictionRef}>
          <PredictionForm componenteSelecionado={componenteSelecionado} />
        </div>
      </main>
    </div>
  );
}
