#!/usr/bin/env python3
"""
Cria categorias raiz de balde + regras de padrão amplo.

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
            {"name": "CPMF/IOF", "pattern": "IOF"},
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


def create_category(api_url: str, headers: dict, name: str) -> str:
    resp = requests.post(
        f"{api_url}/categories",
        json={"name": name},
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 201:
        cat_id = resp.json()["id"]
        print(f"  ✓ Categoria criada: {name!r} → {cat_id}")
        return cat_id
    if resp.status_code == 409:
        print(f"  ~ Categoria já existe: {name!r}, buscando id...")
        existing = requests.get(f"{api_url}/categories", headers=headers, timeout=15)
        for item in existing.json().get("items", []):
            if item["name"] == name:
                print(f"    → {item['id']}")
                return item["id"]
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
        print(f"    ✓ Regra: {name!r} (starts_with {pattern!r})")
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
    parser = argparse.ArgumentParser(description="Seed bucket categories and rules")
    parser.add_argument("--api-url", required=True, help="Base URL da API (ex: https://xxx.execute-api.us-east-1.amazonaws.com/v1)")
    parser.add_argument("--token", required=True, help="JWT token do Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Apenas mostra o que seria criado, sem criar")
    args = parser.parse_args()

    api_url = args.api_url.rstrip("/")
    headers = make_headers(args.token)

    if args.dry_run:
        print("=== DRY RUN — nada será criado ===\n")
        for bucket in BUCKET_DEFINITIONS:
            print(f"Categoria: {bucket['category']}")
            for r in bucket["rules"]:
                print(f"  Regra: {r['name']!r} → starts_with {r['pattern']!r}")
        return

    print(f"API: {api_url}\n")

    priority = 10
    for bucket in BUCKET_DEFINITIONS:
        print(f"\n── {bucket['category']}")
        cat_id = create_category(api_url, headers, bucket["category"])
        if not cat_id:
            print("  ✗ Pulando regras (sem category_id)")
            continue
        for rule in bucket["rules"]:
            create_rule(api_url, headers, rule["name"], rule["pattern"], cat_id, priority)
            priority += 1

    apply_rules(api_url, headers)
    print("\nPronto! Acesse o app → Categorias para revisar.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
