# Banco local de desenvolvimento

**Por quê:** local, produção e os *harnesses* de avaliação compartilhavam o mesmo
banco **Neon**. Cada rodada de dev/harness puxava dados pela rede e consumia a cota
de **transferência** do plano gratuito (5 GB/mês) — que estourou. A solução é
desenvolver contra um **Postgres local** e reservar o Neon só para produção.

> Os **testes** (`pytest`) usam SQLite em memória — não tocam banco nenhum, podem
> rodar à vontade.

## Pré-requisito

Instale o **Docker Desktop** (não vem instalado na máquina). Depois de aberto,
`docker compose` fica disponível no terminal. Se preferir não usar Docker, veja a
alternativa em SQLite no fim deste documento.

## Subir o banco local

```bash
docker compose up -d db
```

Em `backend/.env`, aponte para o banco local (e mantenha o ambiente local):

```
DATABASE_URL=postgresql://scf:scf@localhost:5433/scf
APP_ENV=local
```

Crie o schema (inclui a extensão `pg_trgm`):

```bash
cd backend
alembic upgrade head
```

## Popular com dados

Sem acesso ao Neon (cota estourada), reimporte os extratos originais pela própria
aplicação (pasta `input/`, via a tela de Importação ou a rota de import). Isso
recria os lançamentos e roda a categorização.

Quando a cota do Neon resetar (início do ciclo de cobrança), dá para puxar a base
real de produção para o local **uma única vez**:

```bash
pg_dump "<DATABASE_URL do Neon>" | psql "postgresql://scf:scf@localhost:5433/scf"
```

## Regras

- **Nunca** rode os harnesses de avaliação (`backend/scripts/eval_*`) contra o Neon —
  eles varrem a base inteira. Use sempre o banco local.
- O `DATABASE_URL` do Neon fica **só** nas secrets do GitHub (deploy) e no `.env` de
  quem precisar de produção pontualmente — não no fluxo de dev do dia a dia.

## Alternativa sem Docker: SQLite

Para dev leve sem instalar nada, aponte o `.env` para um arquivo SQLite:

```
DATABASE_URL=sqlite+pysqlite:///./smart_cash_flow.db
APP_ENV=local
```

O schema é criado automaticamente no startup (`create_local_tables`), sem Alembic.

**Limitação:** o SQLite não tem a extensão `pg_trgm`, então a categorização por
similaridade de trigramas (e migrations que usam `pg_trgm`) não funciona — use o
Postgres (Docker) quando precisar testar categorização/import de verdade.
