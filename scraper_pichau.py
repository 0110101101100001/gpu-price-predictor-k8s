"""
Scraper de preços de GPUs - Pichau e Kabum.

Faz loop dinâmico entre os componentes 'RX 7600', 'RTX 5050' e 'RTX 5060',
busca os preços à vista nas lojas Pichau e Kabum, e insere todos os registros
válidos em lote no Supabase com o campo 'loja' devidamente identificado.
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import date
from typing import List, Optional, Dict, Any

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
LOJAS = ["Pichau", "Kabum"]
TABELA = "historico_precos"

TIMEOUT_NAVEGACAO = 60000
TIMEOUT_SELETOR = 10000

# ---------------------------------------------------------------------------
# URLs de busca por loja e componente
# ---------------------------------------------------------------------------
URLS_BUSCA = {
    "Pichau": {
        "RX 7600": "https://www.pichau.com.br/search?q=RX7600",
        "RTX 5050": "https://www.pichau.com.br/search?q=RTX5050",
        "RTX 5060": "https://www.pichau.com.br/search?q=RTX5060",
    },
    "Kabum": {
        "RX 7600": "https://www.kabum.com.br/hardware/placa-de-video-vga/placa-de-video-amd?page_number=1&page_size=60&facet_filters=eyJSYWRlb24gUlggNzAwMCBTZXJpZXMiOlsiUlggNzYwMCJdfQ%3D%3D&sort=most_searched",
        "RTX 5050": "https://www.kabum.com.br/hardware/placa-de-video-vga/placa-de-video-nvidia?page_number=1&page_size=60&facet_filters=eyJHZUZvcmNlIFJUWCBTw6lyaWUgNTAiOlsiUlRYIDUwNTAiXX0%3D&sort=most_searched",
        "RTX 5060": "https://www.kabum.com.br/hardware/placa-de-video-vga/placa-de-video-nvidia?page_number=1&page_size=60&facet_filters=eyJHZUZvcmNlIFJUWCBTw6lyaWUgNTAiOlsiUlRYIDUwNTAiLCJSVFggNTA2MCJdfQ%3D%3D&sort=most_searched",
    },
}

# ---------------------------------------------------------------------------
# Seletores de produto por loja
# ---------------------------------------------------------------------------
PRODUTO_SELECTORES = {
    "Pichau": [
        "a[href*='/placa-de-video/']",
        "a[href*='/p/']",
        "[class*='MuiCard-root']",
        "[class*='MuiGrid-item']",
        "[class*='jss']",
        "[data-testid*='product']",
    ],
    "Kabum": [
        "a.productLink",
        "div.productCard",
        "div.product-item",
        "div[data-testid='product-card']",
        "a[href*='/produto/']",
        ".product-card",
    ],
}

# ---------------------------------------------------------------------------
# Seletores de preço por loja
# ---------------------------------------------------------------------------
PRECO_SELECTORES = {
    "Pichau": [
        "span[class*='price_avista_text']",
        "[class*='price_avista']",
        "div[class*='price_total']",
        ".preco-a-vista",
        ".preco-pix",
        "div[class*='price']",
    ],
    "Kabum": [
        "span.text-base.font-semibold.text-gray-800",
        "span[class*='text-base'][class*='font-semibold']",
        "div.flex.gap-4 > span.text-base",
        ".finalPrice",
        ".price-sale",
        ".price-card",
        "[class*='finalPrice']",
        "[class*='price-sale']",
        "[class*='preco']",
        "span[class*='price']",
        ".productPrice",
    ],
}

# ---------------------------------------------------------------------------
# Funções utilitárias
# ---------------------------------------------------------------------------


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


def buscar_precos_loja(loja: str, termo: str) -> List[float]:
    """
    Navega até a busca da loja especificada e extrai TODOS os preços à vista
    válidos dos resultados encontrados.
    """
    url = URLS_BUSCA.get(loja, {}).get(termo)
    if not url:
        logger.error("URL de busca não configurada para %s - %s", loja, termo)
        return []

    produto_selectores = PRODUTO_SELECTORES.get(loja, [])
    preco_selectores = PRECO_SELECTORES.get(loja, [])

    if not produto_selectores or not preco_selectores:
        logger.error("Seletores não configurados para %s", loja)
        return []

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
            logger.info("Buscando '%s' em %s", termo, url)
            pagina.goto(url, wait_until="domcontentloaded")

            pagina.wait_for_timeout(3000)
            try:
                pagina.evaluate("window.scrollBy(0, 600)")
            except Exception:
                pass
            pagina.wait_for_timeout(3000)

            # Localiza os cards de produto
            cards = []
            for seletor in produto_selectores:
                elementos = pagina.locator(seletor).all()
                if elementos:
                    cards = elementos
                    logger.info(
                        "%d card(s) encontrado(s) com seletor '%s' em %s",
                        len(elementos),
                        seletor,
                        loja,
                    )
                    break

            if not cards:
                logger.warning(
                    "Nenhum elemento de produto recuperado para '%s' na %s.",
                    termo,
                    loja,
                )
                return []

            termo_normalizado = termo.lower().replace(" ", "")
            precos_encontrados = []

            # Itera pelos cards para encontrar preços válidos
            for indice, card in enumerate(cards[:30], start=1):
                try:
                    texto_card = card.inner_text(timeout=TIMEOUT_SELETOR)
                except PlaywrightTimeoutError:
                    continue

                if termo_normalizado not in texto_card.lower().replace(" ", ""):
                    continue

                preco = None
                for seletor_preco in preco_selectores:
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

                # Fallback Regex
                if preco is None:
                    try:
                        precos_regex = re.findall(
                            r"R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}", texto_card
                        )
                        precos_validos_regex = [
                            extrair_preco_float(p) for p in precos_regex
                        ]
                        precos_validos_regex = [
                            p
                            for p in precos_validos_regex
                            if p is not None and p >= 1500
                        ]

                        if len(precos_validos_regex) >= 2:
                            preco = min(precos_validos_regex)
                        elif len(precos_validos_regex) == 1:
                            preco = precos_validos_regex[0]
                    except Exception as exc:
                        logger.debug(
                            "Falha na extração por regex para '%s' na %s: %s",
                            termo,
                            loja,
                            exc,
                        )

                if preco is not None:
                    logger.info(
                        "Produto válido encontrado na %s: %s -> R$ %.2f",
                        loja,
                        termo,
                        preco,
                    )
                    precos_encontrados.append(preco)

            # Retorna todos os preços únicos encontrados
            if precos_encontrados:
                # Remove duplicatas exatas usando set() e ordena do menor pro maior
                precos_unicos = sorted(list(set(precos_encontrados)))
                logger.info(
                    "Preços finais obtidos na %s para '%s': %s (de %d ofertas processadas)",
                    loja,
                    termo,
                    precos_unicos,
                    len(precos_encontrados),
                )
                return precos_unicos

            logger.warning(
                "Nenhum preço válido encontrado para '%s' na %s.",
                termo,
                loja,
            )

        except Exception as exc:
            logger.exception(
                "Erro durante a busca de '%s' na %s: %s", termo, loja, exc
            )
        finally:
            navegador.close()

    return []


def coletar_precos_todas_lojas() -> List[Dict[str, Any]]:
    """
    Itera por todas as lojas e componentes, coletando todos os preços válidos
    para inserção em lote no Supabase.
    """
    todos_registros = []

    for loja in LOJAS:
        logger.info(
            "=== Iniciando extração para a loja %s ===", loja
        )
        for componente in COMPONENTES:
            precos = buscar_precos_loja(loja, componente)
            
            if precos:
                # Agora itera sobre a lista de preços e cria um registo para cada um
                for preco in precos:
                    todos_registros.append(
                        {
                            "componente": componente,
                            "loja": loja,
                            "preco": preco,
                        }
                    )
                    logger.info(
                        "Preparando registro: %s | %s | R$ %.2f",
                        componente,
                        loja,
                        preco,
                    )
            else:
                logger.warning(
                    "Nenhum preço pôde ser registrado para '%s' na %s.",
                    componente,
                    loja,
                )

    return todos_registros


def inserir_bulk_supabase(supabase: Client, registros: list) -> None:
    """Insere múltiplos registros em lote na tabela historico_precos."""
    if not registros:
        logger.warning("Nenhum registro válido para inserção em lote.")
        return

    hoje = date.today().isoformat()
    for reg in registros:
        reg["data_registo"] = hoje

    logger.info(
        "Inserindo %d registro(s) em lote na tabela %s...",
        len(registros),
        TABELA,
    )
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
        logger.error(
            "SUPABASE_URL e/ou SUPABASE_KEY não encontradas no .env."
        )
        return 1

    logger.info(
        "Iniciando scraper de preços (Pichau e Kabum) para: %s",
        ", ".join(COMPONENTES),
    )

    try:
        registros = coletar_precos_todas_lojas()
    except Exception as exc:
        logger.exception("Falha durante a coleta de preços: %s", exc)
        return 1

    if not registros:
        logger.error("Nenhum registro recolhido. A encerrar.")
        return 1

    try:
        supabase: Client = create_client(url, key)
    except Exception as exc:
        logger.exception("Falha ao criar cliente Supabase: %s", exc)
        return 1

    try:
        inserir_bulk_supabase(supabase, registros)
    except Exception as exc:
        logger.exception("Falha ao inserir lote no Supabase: %s", exc)
        return 1

    logger.info(
        "Processo concluído com sucesso: %d registro(s) inseridos no total.",
        len(registros),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())