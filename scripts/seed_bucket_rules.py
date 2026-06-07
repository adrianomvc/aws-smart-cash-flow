#!/usr/bin/env python3
"""
Cria subcategorias de balde dentro de uma categoria pai + regras de padrão amplo.

Uso:
    python scripts/seed_bucket_rules.py \
        --api-url https://<sua-api>.execute-api.us-east-1.amazonaws.com/v1 \
        --token <seu-jwt-token>

O token é o JWT do Supabase. Para obtê-lo, abra o DevTools no app,
vá em Application → Local Storage → supabase.auth.token → access_token.
"""

import argparse
import sys
import requests

PARENT_CATEGORY_NAME = "Financeiro"

BUCKET_DEFINITIONS = [
    {
        "category": "Transferências",
        "rules": [
            {"name": "PIX enviado", "pattern": "PIX TRANSF"},
            {"name": "PIX recebido", "pattern": "PIX RECEB"},
            {"name": "TED enviado", "pattern": "TED"},
            {"name": "DOC enviado", "pattern": "DOC"},
        ],
    },
    {
        "category": "Boletos",
        "rules": [
            {"name": "Pagamento de boleto (TIT)", "pattern": "TIT"},
            {"name": "Pagamento de boleto (PGTO BOL)", "pattern": "PGTO BOL"},
            {"name": "Pagamento de boleto (PAG BOL)", "pattern": "PAG BOL"},
        ],
    },
    {
        "category": "Tarifas bancárias",
        "rules": [
            {"name": "Tarifa bancária", "pattern": "TARIFA"},
            {"name": "TAR (tarifa)", "pattern": "TAR "},
            {"name": "IOF", "pattern": "IOF"},
        ],
    },
    {
        "category": "Saques",
        "rules": [
            {"name": "Saque", "pattern": "SAQUE"},
            {"name": "Retirada", "pattern": "RETIRADA"},
        ],
    },
]


def make_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def find_category_id(items: list, name: str) -> str | None:
    for item in items:
        if item["name"].strip().lower() == name.strip().lower():
            return item["id"]
        found = find_category_id(item.get("children", []), name)
        if found:
            return found
    return None


def fetch_categories(api_url: str, headers: dict) -> list:
    resp = requests.get(f"{api_url}/categories", headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json().get("items", [])


def create_category(api_url: str, headers: dict, name: str, parent_id: str | None = None) -> str:
    payload: dict = {"name": name}
    if parent_id:
        payload["parent_category_id"] = parent_id

    resp = requests.post(f"{api_url}/categories", json=payload, headers=headers, timeout=15)

    if resp.status_code == 201:
        cat_id = resp.json()["id"]
        prefix = f"  dentro de {PARENT_CATEGORY_NAME!r}" if parent_id else ""
        print(f"  ✓ Subcategoria criada: {name!r}{prefix} → {cat_id}")
        return cat_id

    # Já existe — busca pelo nome
    items = fetch_categories(api_url, headers)
    existing_id = find_category_id(items, name)
    if existing_id:
        print(f"  ~ Já existe: {name!r} → {existing_id}")
        return existing_id

    resp.raise_for_status()
    return ""


def create_rule(
    api_url: str, headers: dict, name: str, pattern: str, category_id: str, priority: int
) -> None:
    resp = requests.post(
        f"{api_url}/categorization-rules",
        json={
            "name": name,
            "field": "description",
            "match_type": "starts_with",
            "pattern": pattern,
            "category_id": category_id,
            "priority": priority,
            "active": True,
        },
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 201:
        print(f"    ✓ Regra: {name!r} → starts_with {pattern!r}")
    elif resp.status_code == 409:
        print(f"    ~ Regra já existe: {name!r}")
    else:
        print(f"    ✗ Erro ao criar regra {name!r}: {resp.status_code} {resp.text}")


def apply_rules(api_url: str, headers: dict) -> None:
    print("\nAplicando regras em todas as transações...")
    resp = requests.post(f"{api_url}/categorization-rules/apply", headers=headers, timeout=60)
    if resp.ok:
        data = resp.json()
        print(f"  ✓ {data.get('total_applied', 0)} transações categorizadas")
    else:
        print(f"  ✗ Erro ao aplicar regras: {resp.status_code} {resp.text}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed bucket subcategories under Financeiro")
    parser.add_argument("--api-url", required=True, help="Base URL da API (ex: https://xxx.execute-api.us-east-1.amazonaws.com/v1)")
    parser.add_argument("--token", required=True, help="JWT token do Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Apenas mostra o que seria criado, sem criar")
    args = parser.parse_args()

    api_url = args.api_url.rstrip("/")
    headers = make_headers(args.token)

    if args.dry_run:
        print(f"=== DRY RUN — nada será criado ===\n")
        print(f"Pai: {PARENT_CATEGORY_NAME!r} (deve existir no app)\n")
        for bucket in BUCKET_DEFINITIONS:
            print(f"  Subcategoria: {PARENT_CATEGORY_NAME} → {bucket['category']}")
            for r in bucket["rules"]:
                print(f"    Regra: {r['name']!r} → starts_with {r['pattern']!r}")
        return

    print(f"API: {api_url}\n")

    # Encontra categoria pai "Financeiro"
    print(f"Buscando categoria pai: {PARENT_CATEGORY_NAME!r}...")
    items = fetch_categories(api_url, headers)
    parent_id = find_category_id(items, PARENT_CATEGORY_NAME)
    if not parent_id:
        print(f"✗ Categoria {PARENT_CATEGORY_NAME!r} não encontrada. Verifique o nome no app.")
        sys.exit(1)
    print(f"✓ {PARENT_CATEGORY_NAME!r} encontrada → {parent_id}\n")

    priority = 10
    for bucket in BUCKET_DEFINITIONS:
        print(f"── {PARENT_CATEGORY_NAME} / {bucket['category']}")
        sub_id = create_category(api_url, headers, bucket["category"], parent_id=parent_id)
        if not sub_id:
            print("  ✗ Pulando regras (sem subcategory_id)")
            continue
        for rule in bucket["rules"]:
            create_rule(api_url, headers, rule["name"], rule["pattern"], sub_id, priority)
            priority += 1
        print()

    apply_rules(api_url, headers)
    print("\nPronto! Acesse o app → Categorias → Financeiro para revisar.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
