"""
Gerador de histórico de preços retroativos para a Pichau (Multi-componente).

Gera 60 dias de dados históricos (uma entrada por dia) para as 3 placas
do MVP ('RX 7600', 'RTX 5050', 'RTX 5060') na loja 'Pichau' e insere 
em lote na tabela historico_precos do Supabase.

Variáveis de ambiente necessárias (arquivo .env):
    SUPABASE_URL  -> URL do projeto Supabase
    SUPABASE_KEY  -> chave do Supabase

Execução:
    python gerar_historico_precos.py
"""

from __future__ import annotations

import logging
import os
import random
import sys
from datetime import date, timedelta
from typing import Dict, List, Tuple

from dotenv import load_dotenv
import pandas as pd
from supabase import create_client, Client

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
logger = logging.getLogger("gerar_historico_precos")

# ---------------------------------------------------------------------------
# Constantes e Configurações por Componente (Valores Reais / Coerentes)
# ---------------------------------------------------------------------------
COMPONENTES_CONFIG: Dict[str, Dict[str, Tuple[float, float] | int]] = {
    "RX 7600": {
        "base": (1700.0, 1950.0),
        "vale": (1550.0, 1650.0),
        "pico": (2000.0, 2200.0),
    },
    "RTX 5050": {
        "base": (2200.0, 2500.0),
        "vale": (1999.0, 2150.0),
        "pico": (2600.0, 2850.0),
    },
    "RTX 5060": {
        "base": (3300.0, 3700.0),
        "vale": (2999.0, 3199.0),
        "pico": (3800.0, 4200.0),
    },
}

LOJA = "Pichau"
TABELA = "historico_precos"
DIAS = 60
SEED = 42  # reprodutibilidade


def gerar_serie_componente(componente: str, datas: List[date]) -> List[float]:
    """
    Gera a série temporal de preços para um componente específico,
    incluindo flutuação natural, vales (promoções) e picos (escassez).
    """
    cfg = COMPONENTES_CONFIG[componente]
    base_min, base_max = cfg["base"]
    vale_min, vale_max = cfg["vale"]
    pico_min, pico_max = cfg["pico"]

    precos: List[float] = []
    preco_atual = random.uniform(base_min, base_max)
    
    for _ in range(DIAS):
        # Variação diária suave de até +/- 1.5%
        variacao = preco_atual * random.uniform(-0.015, 0.015)
        preco_atual += variacao
        preco_atual = max(base_min, min(base_max, preco_atual))
        precos.append(round(preco_atual, 2))

    posicoes_usadas = set()

    # Aplica vales (promoções agressivas - 2 ocorrências)
    for _ in range(2):
        while True:
            pos = random.randint(0, DIAS - 1)
            if pos not in posicoes_usadas:
                posicoes_usadas.add(pos)
                break
        duracao = random.randint(1, 2)
        preco_vale = round(random.uniform(vale_min, vale_max), 2)
        for d in range(duracao):
            idx = pos + d
            if idx < DIAS and idx not in posicoes_usadas:
                precos[idx] = preco_vale
                posicoes_usadas.add(idx)

    # Aplica picos de escassez (1 ocorrência)
    for _ in range(1):
        while True:
            pos = random.randint(0, DIAS - 1)
            if pos not in posicoes_usadas:
                posicoes_usadas.add(pos)
                break
        duracao = random.randint(3, 5)
        preco_pico = round(random.uniform(pico_min, pico_max), 2)
        for d in range(duracao):
            idx = pos + d
            if idx < DIAS and idx not in posicoes_usadas:
                precos[idx] = preco_pico
                posicoes_usadas.add(idx)

    return precos


def gerar_dataset_completo() -> pd.DataFrame:
    """
    Gera um DataFrame unificado com 60 dias de histórico para todas as placas.
    """
    random.seed(SEED)
    hoje = date.today()
    datas: List[date] = [hoje - timedelta(days=i) for i in range(DIAS - 1, -1, -1)]

    todos_registros = []

    for componente in COMPONENTES_CONFIG.keys():
        precos = gerar_serie_componente(componente, datas)
        for data_reg, preco in zip(datas, precos):
            todos_registros.append({
                "componente": componente,
                "loja": LOJA,
                "preco": preco,
                "data_registo": data_reg.isoformat(),
            })

    return pd.DataFrame(todos_registros)


def inserir_lote_supabase(supabase: Client, df: pd.DataFrame) -> None:
    """
    Insere os registros do DataFrame na tabela do Supabase em lote.
    """
    registros = df.to_dict(orient="records")
    logger.info("Inserindo %d registros em lote na tabela %s...", len(registros), TABELA)

    resposta = supabase.table(TABELA).insert(registros).execute()

    if getattr(resposta, "error", None):
        logger.error("Erro do Supabase ao inserir lote: %s", resposta.error)
        raise RuntimeError(f"Supabase error: {resposta.error}")

    dados = getattr(resposta, "data", None) or []
    logger.info("Inserção em lote concluída. Linhas inseridas: %d", len(dados))


def main() -> int:
    load_dotenv()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        logger.error("Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_KEY não encontradas no .env.")
        return 1

    logger.info("Gerando dataset histórico de %d dias para as placas: %s", DIAS, ", ".join(COMPONENTES_CONFIG.keys()))

    try:
        df = gerar_dataset_completo()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao gerar dataset: %s", exc)
        return 1

    logger.info("Dataset gerado com sucesso. Amostra (primeiras 5 linhas):")
    logger.info("\n%s", df.head().to_string(index=False))

    try:
        supabase: Client = create_client(url, key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao criar cliente Supabase: %s", exc)
        return 1

    try:
        inserir_lote_supabase(supabase, df)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao inserir lote no Supabase: %s", exc)
        return 1

    logger.info("Processo concluído com sucesso: %d registros inseridos no total.", len(df))
    return 0


def test_gerar_dataset_completo():
    df = gerar_dataset_completo()
    assert not df.empty


if __name__ == "__main__":
    sys.exit(main())