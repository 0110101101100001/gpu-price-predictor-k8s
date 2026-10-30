# Rastreador de Preços — Dashboard (React + Tailwind)

Dashboard frontend para o rastreador de preços de GPU (RX 7600, RTX 5050, RTX 5060), integrado com a API FastAPI construída anteriormente.

## Estrutura

```
dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── data/                    # (removido mockData.js — dados agora vêm do Supabase)
    ├── utils/
    │   ├── api.js               # Chamadas à API /predict e /health
    │   └── formatters.js        # Formatação de moeda, percentual, datas
    └── components/
        ├── Layout.jsx           # Layout com sidebar
        ├── Sidebar.jsx          // Barra lateral escura de navegação
        ├── MetricCard.jsx       // Card de métrica com tendência
        ├── ChartPanel.jsx       // Gráfico de histórico (Recharts)
        ├── RankingPanel.jsx     // Tabela de ranking de ofertas
        ├── PredictionForm.jsx   // Formulário de teste da API /predict
        └── ui/
            ├── Card.jsx
            ├── Badge.jsx
            ├── Button.jsx
            └── utils.js         # cn (clsx + tailwind-merge)
```

## Requisitos

- Node.js 18+
- API FastAPI rodando em `http://localhost:8000` (endereços `/health` e `/predict`)

## Instalação

```bash
# Na raiz do dashboard
cd dashboard

# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Acessar: http://localhost:5173
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do dashboard (exemplo em `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção |
| `npm run preview` | Pré-visualizar build de produção |

## Integração com a API

O dashboard consome a API FastAPI através de `src/utils/api.js`:

- `GET /health` — verifica se a API está online
- `POST /predict` — envia `{preco, media_movel_7d, variacao_percentual}` e retorna a recomendação

A predição é acionada no formulário "Teste de Predição". Se a API estiver indisponível, o dashboard exibe um erro amigável.

## Destaques da UI

- Sidebar escura com navegação (Dashboard, Componentes, Alertas, Configurações)
- 4 cards de métricas principais (preço médio, variação semanal, taxa de variação, confiança do modelo)
- Gráfico de linha com histórico de preços (Recharts) para RX 7600, RTX 5050 e RTX 5060
- Ranking de ofertas com indicação de melhor preço / em alta / estável
- Formulário interativo integrado à API `/predict` com retorno em tempo real
- Paleta alinhada ao Material Design com cores `brand`, `success`, `danger`, `warning`
- Componentes reutilizáveis (`Card`, `Badge`, `Button`, `MetricCard`)
