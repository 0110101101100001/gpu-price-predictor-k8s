"""
API de predição de preços de GPU (RX 7600, RTX 5050, RTX 5060 - Pichau).

Endpoints:
    GET  /api/health   -> liveness probe ({"status": "ok"})
    POST /api/predict  -> recebe {preco, media_movel_7d, variacao_percentual}
                          e retorna {"recomendacao": "Comprar Agora" | "Aguardar Queda"}

Execução:
    uvicorn api:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, Dict

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuração de logging (stdout)
# ---------------------------------------------------------------------------
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("api_precos")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
ARQUIVO_MODELO = "modelo_precos.joblib"

# Variável global para o modelo (carregada no startup)
modelo: Any = None


class PredicaoInput(BaseModel):
    """
    Payload de entrada para predição.
    """
    preco: float = Field(..., description="Preço atual do produto")
    media_movel_7d: float = Field(..., description="Média móvel dos últimos 7 dias")
    variacao_percentual: float = Field(..., description="Variação percentual em relação ao dia anterior")


class PredicaoOutput(BaseModel):
    """
    Payload de saída da predição.
    """
    recomendacao: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerencia o ciclo de vida da aplicação: carrega o modelo na inicialização.
    """
    global modelo
    logger.info("Iniciando aplicação e carregando modelo: %s", ARQUIVO_MODELO)
    try:
        modelo = joblib.load(ARQUIVO_MODELO)
        logger.info("Modelo carregado com sucesso.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao carregar o modelo: %s", exc)
        modelo = None
    yield
    logger.info("Encerrando aplicação.")


app = FastAPI(
    title="API de Predição de Preços - GPUs (Pichau)",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware CORS para permitir requisições do frontend (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", status_code=200)
async def health() -> Dict[str, str]:
    """
    Endpoint de saúde (liveness probe para Kubernetes).
    """
    return {"status": "ok"}


@app.post("/api/predict", response_model=PredicaoOutput)
async def predict(payload: PredicaoInput) -> Dict[str, str]:
    """
    Recebe features de preço e retorna a recomendação do modelo.
    """
    if modelo is None:
        logger.error("Modelo não carregado. Não é possível realizar predição.")
        raise HTTPException(status_code=503, detail="Modelo não disponível.")

    try:
        # --- 1. REGRA DE SEGURANÇA (Guardrail para promoções expressivas) ---
        # Se o preço estiver 10% ou mais abaixo da média móvel, o sistema assume "Comprar Agora"
        if payload.media_movel_7d > 0:
            desconto_real = ((payload.media_movel_7d - payload.preco) / payload.media_movel_7d) * 100
            if desconto_real >= 10.0:
                logger.info(
                    "Guardrail ativado: Preço R$ %.2f está %.1f%% abaixo da média (R$ %.2f) -> Comprar Agora",
                    payload.preco,
                    desconto_real,
                    payload.media_movel_7d,
                )
                return {"recomendacao": "Comprar Agora"}

        # --- 2. PREDIÇÃO VIA MODELO XGBOOST ---
        # Passamos um DataFrame com os nomes exatos das colunas para garantir alinhamento correto
        dados_df = pd.DataFrame(
            [[payload.preco, payload.media_movel_7d, payload.variacao_percentual]],
            columns=["preco", "media_movel_7d", "variacao_percentual"]
        )
        
        predicao = modelo.predict(dados_df)[0]

        if int(predicao) == 1:
            recomendacao = "Comprar Agora"
        else:
            recomendacao = "Aguardar Queda"

        logger.info(
            "Predição realizada via ML: preco=%.2f, mm7d=%.2f, var=%.2f%% -> %s",
            payload.preco,
            payload.media_movel_7d,
            payload.variacao_percentual,
            recomendacao,
        )

        return {"recomendacao": recomendacao}

    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Erro ao realizar predição: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}")


if __name__ == "__main__":
    import uvicorn

    porta = int(os.getenv("PORT", "8000"))
    logger.info("Iniciando servidor uvicorn na porta %d", porta)
    uvicorn.run(app, host="0.0.0.0", port=porta, log_level="info")