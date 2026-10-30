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
  // Transforma o array bruto do Supabase [{ data_registo, componente, preco }, ...] 
  // num formato amigável para o Recharts agrupado por data.
  const mapaDatas = {};

  dados.forEach((d) => {
    const dataReg = d.data_registo;
    if (!mapaDatas[dataReg]) {
      mapaDatas[dataReg] = { data: dataReg };
    }
    mapaDatas[dataReg][d.componente] = d.preco;
  });

  const dadosGrafico = Object.values(mapaDatas).sort(
    (a, b) => new Date(a.data) - new Date(b.data)
  );

  const temDados = dadosGrafico.length > 0;

  // Lista de componentes disponíveis no MVP
  const componentesDisponiveis = ["RX 7600", "RTX 5050", "RTX 5060"];

  return (
    <div className={cn("chart-container bg-white p-6 rounded-2xl shadow-sm border border-gray-100", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Histórico de Preços</h2>
          <p className="text-sm text-gray-500">
            {componente} — Pichau
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
                    ? "bg-gray-100 border-gray-300 text-gray-900 font-semibold"
                    : "bg-white border-gray-100 text-gray-400 opacity-60"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: COLORS[comp] }}
                />
                {comp}
              </span>
            );
          })}
        </div>
      </div>

      {!temDados ? (
        <div className="h-80 w-full bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center p-6">
          <p className="text-gray-400 text-sm mb-2">Nenhum histórico disponível</p>
          <p className="text-xs text-gray-500">Execute o scraper para popular o Supabase</p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="data"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tickFormatter={(value) => `R$ ${value}`}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickMargin={10}
                width={60}
                domain={['auto', 'auto']}
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
                formatter={(value) => [`R$ ${value}`, "Preço"]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend verticalAlign="top" align="right" height={36} />

              {/* Renderiza a linha apenas da placa selecionada com destaque, ou todas esmaecidas */}
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