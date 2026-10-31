import { useState, useEffect, useRef } from "react";
import {
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
  const [componenteSelecionado, setComponenteSelecionado] = useState("RTX 5060");

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

  const dadosFiltrados = dadosHistorico.filter(
    (d) => d.componente === componenteSelecionado
  );

  const precoRecenteSelecionado = precosRecentes.find(
    (r) => r.componente === componenteSelecionado
  );

  const mediaMovelSelecionada =
    dadosFiltrados.length > 0
      ? dadosFiltrados.reduce((soma, d) => soma + d.preco, 0) /
        dadosFiltrados.length
      : 0;

  let variacaoSemanalComp = 0;
  if (dadosFiltrados.length >= 2) {
    const primeiro = dadosFiltrados[0].preco;
    const ultimo = dadosFiltrados[dadosFiltrados.length - 1].preco;
    if (primeiro > 0) {
      variacaoSemanalComp = ((ultimo - primeiro) / primeiro) * 100;
    }
  }

  let taxaVariacaoComp = 0;
  if (dadosFiltrados.length >= 2) {
    const ultimos = dadosFiltrados.slice(-2);
    const anterior = ultimos[0].preco;
    const atual = ultimos[1].preco;
    if (anterior > 0) {
      taxaVariacaoComp = ((atual - anterior) / anterior) * 100;
    }
  }

  const tendenciaSelecionada =
    dadosFiltrados.length >= 2
      ? dadosFiltrados[dadosFiltrados.length - 1].preco >
        dadosFiltrados[dadosFiltrados.length - 2].preco
        ? "alta"
        : "baixa"
      : "estavel";

  const confiancaModelo = 87;

  let ranking = [];
  
  if (dadosFiltrados.length > 0) {
    const ultimaData = dadosFiltrados[dadosFiltrados.length - 1].data_registo.split("T")[0];

    const ofertasAtivas = dadosFiltrados.filter((d) => 
      d.data_registo.startsWith(ultimaData)
    );

    ranking = ofertasAtivas
      .map((item, index) => {
        const variacaoFaceAMedia = mediaMovelSelecionada > 0 
          ? ((item.preco - mediaMovelSelecionada) / mediaMovelSelecionada) * 100 
          : 0;

        return {
          id: item.id || `ranking-${index}`,
          nome: item.componente,
          loja: item.loja || "Pichau",
          preco: item.preco || 0,
          variacao: variacaoFaceAMedia,
          tendencia: variacaoFaceAMedia < -1 ? "baixa" : variacaoFaceAMedia > 1 ? "alta" : "estavel",
        };
      })
      .sort((a, b) => a.preco - b.preco)
      .slice(0, 5); 
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-slate-400 font-medium">Carregando dados do Supabase…</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-slate-900/60 backdrop-blur-md border border-slate-800/50 shadow-2xl rounded-2xl p-6">
          <ShieldCheck className="w-8 h-8 text-rose-400 mb-4" />
          <h2 className="text-lg font-bold text-slate-100 mb-2">Erro ao carregar dados</h2>
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

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="pt-8 pb-12 px-4 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard de Preços</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1 rounded-xl bg-slate-800/60 border border-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Pichau
              </span>
              <span className="text-sm text-slate-400 font-medium">Monitoramento em tempo real</span>
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

        <div className="flex flex-wrap items-center justify-between gap-6 mb-8 bg-slate-900/50 backdrop-blur-md border border-slate-800/40 shadow-lg rounded-2xl p-8">
          <span className="text-sm font-medium text-slate-400">Placa de vídeo:</span>
          <div className="flex gap-2 items-center">
            {COMPONENTES_MVP.map((comp) => (
              <button
                key={comp}
                onClick={() => setComponenteSelecionado(comp)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  componenteSelecionado === comp
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900/40 text-slate-500 border border-slate-700/30 hover:bg-slate-800/30 hover:text-slate-300"
                }`}
              >
                {comp}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            componente={componenteSelecionado}
            titulo="Preço Atual"
            subtitulo="Atualizado hoje"
            valorExibido={
              precoRecenteSelecionado?.preco
                ? formatCurrency(precoRecenteSelecionado.preco)
                : "—"
            }
            tendencia={tendenciaSelecionada}
            variant="blue"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Variação Semanal"
            subtitulo="Tendência recente"
            valorExibido={
              dadosFiltrados.length >= 2
                ? `${variacaoSemanalComp >= 0 ? "+" : ""}${variacaoSemanalComp.toFixed(1)}%`
                : "—"
            }
            tendencia={variacaoSemanalComp >= 0 ? "alta" : "baixa"}
            variant="default"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Taxa de Variação"
            subtitulo="Últimos dias"
            valorExibido={
              dadosFiltrados.length >= 2
                ? `${taxaVariacaoComp >= 0 ? "+" : ""}${taxaVariacaoComp.toFixed(1)}%`
                : "—"
            }
            tendencia={taxaVariacaoComp >= 0 ? "alta" : "baixa"}
            variant="warning"
          />
          <MetricCard
            componente={componenteSelecionado}
            titulo="Confiança do Modelo"
            subtitulo="Eficácia da recomendação"
            valorExibido={`${confiancaModelo}%`}
            tendencia="alta"
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <ChartPanel componente={componenteSelecionado} dados={dadosFiltrados} />
          </div>
          <div className="lg:col-span-1">
            <RankingPanel
              componente={componenteSelecionado}
              componentes={ranking}
            />
          </div>
        </div>

        <div className="mb-8" ref={predictionRef}>
          <PredictionForm componenteSelecionado={componenteSelecionado} />
        </div>
      </main>
    </div>
  );
}
