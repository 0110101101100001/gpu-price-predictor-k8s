"""
Scraper de preços da Pichau.

Faz loop dinâmico entre os componentes 'RX 7600', 'RTX 5050' e 'RTX 5060',
busca o preço à vista do primeiro resultado relevante em cada um, e insere
os registros em lote no Supabase.
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import date
from typing import List, Optional, Dict

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
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
logger = logging.getLogger("scraper_pichau")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
COMPONENTES = ["RX 7600", "RTX 5050", "RTX 5060"]
LOJA = "Pichau"
TABELA = "historico_precos"

URL_BUSCA = "https://www.pichau.com.br/search?q={termo}"

# Seletores Material-UI da Pichau
PRODUTO_SELECTORES = [
    "a[href*='/placa-de-video/']",
    "a[href*='/p/']",
    "[class*='MuiCard-root']",
    "[class*='MuiGrid-item']",
    "[class*='jss']",
    "[data-testid*='product']"
]

PRECO_SELECTORES = [
    "span[class*='price_avista_text']",
    "[class*='price_avista']",
    "div[class*='price_total']",
    ".preco-a-vista",
    ".preco-pix",
    "div[class*='price']"
]

TIMEOUT_NAVEGACAO = 60000
TIMEOUT_SELETOR = 10000


def extrair_preco_float(texto: Optional[str]) -> Optional[float]:
    """Converte texto de preço formato brasileiro para float."""
    if not texto:
        return None

    limpo = re.sub(r"(?i)r\$\s*", "", texto)
    limpo = re.sub(r"(?i)\b(à\s*vista|avista|a\s*vista|pix)\b", "", limpo)
    limpo = re.sub(r"[^0-9.,]", "", limpo).strip()
    if not limpo:
        return None

    if "," in limpo and "." in limpo:
        limpo = limpo.replace(".", "").replace(",", ".")
    elif "," in limpo:
        limpo = limpo.replace(",", ".")

    try:
        return float(limpo)
    except ValueError:
        return None


def buscar_todos_produtos_pichau(termo: str) -> List[Dict[str, any]]:
    """
    Navega até a busca da Pichau e extrai TODOS os produtos relevantes encontrados,
    retornando uma lista com o nome específico do modelo e o preço à vista.
    """
    produtos_encontrados = []

    with sync_playwright() as p:
        navegador = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        contexto = navegador.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
        )
        pagina = contexto.new_page()
        pagina.set_default_timeout(TIMEOUT_NAVEGACAO)

        try:
            url = URL_BUSCA.format(termo=termo.replace(" ", ""))
            logger.info("Buscando '%s' em %s", termo, url)
            pagina.goto(url, wait_until="domcontentloaded")

            pagina.wait_for_timeout(3000)
            try:
                pagina.evaluate("window.scrollBy(0, 600)")
            except Exception:
                pass
            pagina.wait_for_timeout(3000)

            # Localiza os cards
            cards = []
            for seletor in PRODUTO_SELECTORES:
                elementos = pagina.locator(seletor).all()
                if elementos:
                    cards = elementos
                    logger.info("%d card(s) encontrado(s) com seletor '%s'", len(elementos), seletor)
                    break

            if not cards:
                logger.warning("Nenhum elemento de produto recuperado para '%s'.", termo)
                return []

            termo_lower = termo.lower().replace(" ", "")

            # Itera por vários cards para capturar todas as variantes disponíveis
            for indice, card in enumerate(cards[:15], start=1):
                try:
                    texto_card = card.inner_text(timeout=TIMEOUT_SELETOR)
                except PlaywrightTimeoutError:
                    continue

                if termo_lower not in texto_card.lower().replace(" ", ""):
                    continue

                # Tenta extrair o preço
                preco = None
                for seletor_preco in PRECO_SELECTORES:
                    try:
                        elemento_preco = card.locator(seletor_preco).first
                        if elemento_preco.count() == 0:
                            continue
                        texto_preco = elemento_preco.inner_text(timeout=TIMEOUT_SELETOR)
                        preco = extrair_preco_float(texto_preco)
                        if preco is not None:
                            break
                    except Exception:
                        continue

                if preco is not None:
                    produtos_encontrados.append({
                        "componente": termo,
                        "loja": LOJA,
                        "preco": preco,
                    })
                    logger.info("Produto capturado: %s -> R$ %.2f", termo, preco)

        except Exception as exc:
            logger.exception("Erro durante a busca de '%s': %s", termo, exc)
        finally:
            navegador.close()

    return produtos_encontrados


def inserir_bulk_supabase(supabase: Client, registros: list) -> None:
    """Insere múltiplos registros em lote na tabela historico_precos."""
    if not registros:
        logger.warning("Nenhum registo válido para inserção em lote.")
        return

    hoje = date.today().isoformat()
    for reg in registros:
        reg["data_registo"] = hoje

    logger.info("Inserindo %d registo(s) em lote na tabela %s...", len(registros), TABELA)
    resposta = supabase.table(TABELA).insert(registros).execute()

    if getattr(resposta, "error", None):
        logger.error("Erro do Supabase ao inserir lote: %s", resposta.error)
        raise RuntimeError(f"Supabase error: {resposta.error}")

    dados = getattr(resposta, "data", None) or []
    logger.info("Bulk insert concluído. Linhas inseridas: %d", len(dados))


def main() -> int:
    load_dotenv()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        logger.error("SUPABASE_URL e/ou SUPABASE_KEY não encontradas no .env.")
        return 1

    logger.info("Iniciando scraper multimodelo da Pichau para: %s", ", ".join(COMPONENTES))

    todos_registros = []

    for componente in COMPONENTES:
        produtos = buscar_todos_produtos_pichau(componente)
        if produtos:
            todos_registros.extend(produtos)
        else:
            logger.warning("Nenhum produto encontrado para '%s'.", componente)

    if not todos_registros:
        logger.error("Nenhum registo recolhido. A encerrar.")
        return 1

    try:
        supabase: Client = create_client(url, key)
    except Exception as exc:
        logger.exception("Falha ao criar cliente Supabase: %s", exc)
        return 1

    try:
        inserir_bulk_supabase(supabase, todos_registros)
    except Exception as exc:
        logger.exception("Falha ao inserir lote no Supabase: %s", exc)
        return 1

    logger.info("Processo concluído com sucesso: %d registos inseridos no total.", len(todos_registros))
    return 0


if __name__ == "__main__":
    sys.exit(main())