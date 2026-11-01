import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "./ui/utils";

const COLORS = {
  "RX 7600": "#3b82f6", // blue-500
  "RTX 5050": "#10b981", // emerald-500
  "RTX 5060": "#f59e0b", // amber-500
};

export const ChartPanel = ({ componente, dados = [], className }) => {
  const mapaDatas = {};

  dados.forEach((d) => {
    const dataReg = d.data_registo;
    if (!mapaDatas[dataReg]) {
      mapaDatas[dataReg] = { data: dataReg };
    }

    // Para cada data e componente, manter apenas o menor preço (melhor oferta)
    const precoAtual = mapaDatas[dataReg][d.componente];
    if (precoAtual === undefined || d.preco < precoAtual) {
      mapaDatas[dataReg][d.componente] = d.preco;
    }
  });

  const dadosGrafico = Object.values(mapaDatas).sort(
    (a, b) => new Date(a.data) - new Date(b.data)
  );

  const temDados = dadosGrafico.length > 0;

  const componentesDisponiveis = ["RX 7600", "RTX 5050", "RTX 5060"];

  return (
    <div className={cn("chart-container", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Histórico de Preços</h2>
          <p className="text-sm text-slate-400">
            Evolução temporal e flutuação de mercado
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {componentesDisponiveis.map((comp) => {
            const ativo = componente === comp;
            return (
              <span
                key={comp}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  ativo
                    ? "bg-blue-600/20 border-blue-500/30 text-blue-100 font-semibold"
                    : "bg-slate-900/20 border-slate-700/30 text-slate-500"
                }`}
              >
                {ativo && (
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[comp] }} />
                )}
                {comp}
              </span>
            );
          })}
        </div>
      </div>

      {!temDados ? (
        <div className="h-80 w-full bg-slate-900/30 rounded-xl border border-slate-800/30 flex flex-col items-center justify-center text-center p-6">
          <p className="text-slate-400 text-sm mb-2">Nenhum histórico disponível</p>
          <p className="text-xs text-slate-600">Execute o scraper para popular o Supabase</p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico}>
              <defs>
                <linearGradient id="colorRx7600" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRtx5050" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRtx5060" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" vertical={false} />

              <XAxis
                dataKey="data"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value) => {
                  const d = new Date(value);
                  return d.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  });
                }}
              />

              <YAxis
                tickFormatter={(value) => `R$ ${value}`}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickMargin={10}
                width={60}
                domain={["auto", "auto"]}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  padding: "10px 16px",
                  fontSize: "13px",
                }}
                itemStyle={{ color: "#1e293b", fontWeight: 600 }}
                formatter={(value) => `R$ ${value}`}
                labelFormatter={(label) => `Data: ${label}`}
              />

              <Legend verticalAlign="top" align="right" height={36} />

              {componentesDisponiveis.map((comp) => {
                const isSelected = componente === comp;
                return (
                  <Line
                    key={comp}
                    type="monotone"
                    dataKey={comp}
                    stroke={COLORS[comp]}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeOpacity={isSelected ? 1 : 0.3}
                    dot={isSelected ? { r: 4 } : false}
                    activeDot={{ r: 6 }}
                    name={comp}
                    connectNulls
                    fill={isSelected ? `url(#color${comp.replace(/\s/g, "")})` : "none"}
                    fillOpacity={isSelected ? 0.2 : 0}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
