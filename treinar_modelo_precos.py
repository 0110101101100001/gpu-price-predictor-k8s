"""
Treinamento de modelo de classificação de preços (RTX 5060 - Pichau).

Passos:
    1. Conecta ao Supabase (SUPABASE_URL / SUPABASE_KEY do .env).
    2. Extrai todos os dados da tabela historico_precos para um DataFrame pandas.
    3. Ordena por data e cria features:
         - media_movel_7d: média dos preços dos últimos 7 dias.
         - variacao_percentual: diferença percentual do preço de hoje vs ontem.
    4. Cria target de classificação:
         - 1 ('Comprar Agora') se preço atual estiver >= 5% abaixo da média móvel de 7d.
         - 0 ('Aguardar Queda') caso contrário.
    5. Data Augmentation: injeta exemplos sintéticos de "mega promoção"
         (preços de liquidação entre R$ 800,00 e R$ 1.600,00) para melhorar
         a detecção de outliers de promoção extrema.
    6. Treina um XGBClassifier com features [preco, media_movel_7d, variacao_percentual].
    7. Guarda o modelo treinado em modelo_precos.joblib (joblib).

Variáveis de ambiente necessárias (arquivo .env):
    SUPABASE_URL  -> URL do projeto Supabase
    SUPABASE_KEY  -> chave do Supabase

Execução:
    python treinar_modelo_precos.py
"""

from __future__ import annotations

import logging
import os
import random
import sys
from typing import Tuple

from dotenv import load_dotenv
import pandas as pd
from supabase import create_client, Client
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

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
logger = logging.getLogger("treinar_modelo_precos")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
TABELA = "historico_precos"
ARQUIVO_MODELO = "modelo_precos.joblib"
LIMITE_DESCONTO = 0.95  # preço >= 5% abaixo da média móvel -> Comprar Agora
JANELA_MEDIA_MOVEL = 7
TEST_SIZE = 0.2
RANDOM_STATE = 42

FEATURES = ["preco", "media_movel_7d", "variacao_percentual"]
TARGET = "target"

# ---------------------------------------------------------------------------
# Constantes de Data Augmentation (mega promoções / outliers)
# ---------------------------------------------------------------------------
QTD_SINTETICOS = 75  # número de exemplos extremos a gerar
PRECO_SINTETICO_MIN = 800.0   # preço de liquidação agressiva (mínimo)
PRECO_SINTETICO_MAX = 1600.0  # preço de liquidação agressiva (máximo)
MEDIA_MOVEL_SINTETICA_MIN = 2500.0  # patamar normal da média móvel (mínimo)
MEDIA_MOVEL_SINTETICA_MAX = 3200.0  # patamar normal da média móvel (máximo)
VARIACAO_SINTETICA_MIN = -80.0  # queda percentual mínima (ex: -80%)
VARIACAO_SINTETICA_MAX = -40.0  # queda percentual máxima (ex: -40%)
TARGET_SINTETICO = 1  # 'Comprar Agora'


def gerar_exemplos_extremos(qtd: int = QTD_SINTETICOS) -> pd.DataFrame:
    """
    Gera artificialmente exemplos extremos de 'mega promoção' para mitigar
    a falha do modelo ao classificar preços muito baixos (outliers) que não
    aparecem com frequência no dataset original.

    Cada linha sintética possui:
        - preco: entre R$ 800,00 e R$ 1.600,00 (liquidação agressiva)
        - media_movel_7d: entre R$ 2.500,00 e R$ 3.200,00 (patamar normal)
        - variacao_percentual: entre -80% e -40% (queda drástica)
        - target: 1 ('Comprar Agora')

    Retorna um DataFrame com as mesmas colunas de features + target.
    """
    logger.info("Gerando %d exemplos sintéticos de mega promoção (data augmentation)...", qtd)

    random.seed(RANDOM_STATE)

    dados_sinteticos = []
    for _ in range(qtd):
        preco = round(random.uniform(PRECO_SINTETICO_MIN, PRECO_SINTETICO_MAX), 2)
        media_movel = round(random.uniform(MEDIA_MOVEL_SINTETICA_MIN, MEDIA_MOVEL_SINTETICA_MAX), 2)
        variacao = round(random.uniform(VARIACAO_SINTETICA_MIN, VARIACAO_SINTETICA_MAX), 2)

        dados_sinteticos.append({
            "preco": preco,
            "media_movel_7d": media_movel,
            "variacao_percentual": variacao,
            TARGET: TARGET_SINTETICO,
        })

    df_sintetico = pd.DataFrame(dados_sinteticos)
    logger.info("Exemplos sintéticos gerados: %d linhas.", len(df_sintetico))
    return df_sintetico


def extrair_dados_supabase(url: str, key: str) -> pd.DataFrame:
    """
    Conecta ao Supabase e extrai todos os registros da tabela historico_precos
    para um DataFrame pandas.
    """
    logger.info("Conectando ao Supabase e extraindo dados da tabela %s...", TABELA)
    supabase: Client = create_client(url, key)

    resposta = supabase.table(TABELA).select("*").execute()

    if getattr(resposta, "error", None):
        logger.error("Erro do Supabase ao extrair dados: %s", resposta.error)
        raise RuntimeError(f"Supabase error: {resposta.error}")

    dados = getattr(resposta, "data", None) or []
    if not dados:
        logger.warning("A tabela %s está vazia. Nenhum dado extraído.", TABELA)
        return pd.DataFrame()

    df = pd.DataFrame(dados)
    logger.info("%d registros extraídos do Supabase.", len(df))
    return df


def preparar_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Ordena por data, cria features de média móvel e variação percentual,
    gera o target de classificação e injeta exemplos sintéticos de mega
    promoção (data augmentation).

    Retorna (X, y) prontos para treino.
    """
    if df.empty:
        raise ValueError("DataFrame vazio. Não é possível preparar features.")

    # Normaliza nomes de colunas (minúsculas, sem espaços)
    df.columns = [c.strip().lower() for c in df.columns]

    colunas_necessarias = {"componente", "loja", "preco", "data_registo"}
    faltando = colunas_necessarias - set(df.columns)
    if faltando:
        raise ValueError(f"Colunas ausentes no DataFrame: {faltando}")

    # Converte tipos
    df["preco"] = pd.to_numeric(df["preco"], errors="coerce")
    df["data_registo"] = pd.to_datetime(df["data_registo"], errors="coerce")

    # Remove linhas com preço ou data inválidos
    antes = len(df)
    df = df.dropna(subset=["preco", "data_registo"])
    depois = len(df)
    if antes != depois:
        logger.warning("%d linha(s) removida(s) por preço/data inválido(s).", antes - depois)

    # Ordena por data crescente (ordem temporal)
    df = df.sort_values("data_registo").reset_index(drop=True)

    # Cria features
    df["media_movel_7d"] = (
        df["preco"].rolling(window=JANELA_MEDIA_MOVEL, min_periods=1).mean()
    )
    df["variacao_percentual"] = df["preco"].pct_change() * 100.0

    # Target: 1 se preço está >= 5% abaixo da média móvel de 7d
    df[TARGET] = (
        (df["preco"] <= df["media_movel_7d"] * LIMITE_DESCONTO).astype(int)
    )

    # Remove primeiras linhas com NaN decorrentes do pct_change (variacao_percentual)
    df_modelo = df.dropna(subset=["variacao_percentual"]).copy()

    if df_modelo.empty:
        raise ValueError("Não há dados suficientes após remover NaNs das features.")

    # --- Data Augmentation: injeta exemplos extremos de mega promoção ---
    df_sintetico = gerar_exemplos_extremos(QTD_SINTETICOS)

    # Alinha colunas (garante mesma ordem e nomes)
    df_sintetico = df_sintetico[FEATURES + [TARGET]]

    df_modelo = pd.concat([df_modelo, df_sintetico], ignore_index=True)

    logger.info(
        "Data augmentation aplicado: %d linhas originais + %d sintéticas = %d totais.",
        len(df_modelo) - len(df_sintetico),
        len(df_sintetico),
        len(df_modelo),
    )

    X = df_modelo[FEATURES].copy()
    y = df_modelo[TARGET].copy()

    logger.info("Features criadas: %s", FEATURES)
    logger.info("Target: %s", TARGET)
    logger.info("Distribuição do target:\n%s", y.value_counts().to_string())

    return X, y


def treinar_modelo(X: pd.DataFrame, y: pd.Series) -> XGBClassifier:
    """
    Treina um XGBClassifier com hiperparâmetros adequados para dados tabulares
    e não-linearidades, evitando overfitting. Imprime métricas de avaliação.
    """
    classes_unicas = y.nunique()
    if classes_unicas < 2:
        logger.warning(
            "Apenas %d classe(s) encontrada(s) no target. Treinando com todos os dados.",
            classes_unicas,
        )
        modelo = XGBClassifier(
            n_estimators=150,
            learning_rate=0.1,
            max_depth=5,
            random_state=RANDOM_STATE,
            use_label_encoder=False,
            eval_metric="logloss",
        )
        modelo.fit(X, y)
        logger.info("Modelo treinado com %d amostras (sem divisão treino/teste).", len(X))
        return modelo

    X_treino, X_teste, y_treino, y_teste = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    modelo = XGBClassifier(
        n_estimators=150,
        learning_rate=0.1,
        max_depth=5,
        random_state=RANDOM_STATE,
        use_label_encoder=False,
        eval_metric="logloss",
    )
    modelo.fit(X_treino, y_treino)

    y_pred = modelo.predict(X_teste)
    acuracia = accuracy_score(y_teste, y_pred)
    logger.info("Acurácia no teste: %.4f", acuracia)
    logger.info("Relatório de classificação:\n%s", classification_report(y_teste, y_pred))

    logger.info("Modelo treinado com %d amostras (treino) e %d (teste).", len(X_treino), len(X_teste))
    return modelo


def salvar_modelo(modelo: XGBClassifier, caminho: str = ARQUIVO_MODELO) -> None:
    """
    Serializa o modelo treinado em disco usando joblib.
    """
    joblib.dump(modelo, caminho)
    logger.info("Modelo salvo em: %s", caminho)


def main() -> int:
    load_dotenv()  # carrega SUPABASE_URL e SUPABASE_KEY do .env

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        logger.error("Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_KEY não encontradas no .env.")
        return 1

    try:
        df = extrair_dados_supabase(url, key)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao extrair dados do Supabase: %s", exc)
        return 1

    if df.empty:
        logger.error("Nenhum dado disponível para treino. Encerrando.")
        return 1

    try:
        X, y = preparar_features(df)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao preparar features: %s", exc)
        return 1

    try:
        modelo = treinar_modelo(X, y)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao treinar modelo: %s", exc)
        return 1

    try:
        salvar_modelo(modelo, ARQUIVO_MODELO)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao salvar modelo: %s", exc)
        return 1

    logger.info("Processo concluído com sucesso. Modelo gerado: %s", ARQUIVO_MODELO)
    return 0


if __name__ == "__main__":
    sys.exit(main())
