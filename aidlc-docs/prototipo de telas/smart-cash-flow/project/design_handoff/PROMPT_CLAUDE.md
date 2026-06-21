# Prompts prontos para Claude Desktop

Use estes prompts diretamente no Claude Desktop com o MCP filesystem apontando
para a pasta `aws-smart-cash-flow/`.

---

## 🚀 Prompt de contexto inicial (use sempre primeiro)

```
Você está trabalhando no projeto aws-smart-cash-flow.
Leia os seguintes arquivos para entender o contexto:
- design_handoff/README.md
- frontend/src/App.tsx
- frontend/src/types.ts
- backend/app/db/models.py
- aidlc-docs/09-mvp-technical-contract.md

Confirme que leu e me diga o estado atual do projeto em 3 linhas.
```

---

## 🎨 Prompt 1 — Tokens de design (Tailwind)

```
Leia o arquivo design_handoff/tokens.ts.

Substitua o conteúdo de frontend/tailwind.config.ts pelos tokens do arquivo.

Depois, adicione as CSS variables do comentário no final do tokens.ts
ao início do arquivo frontend/src/styles.css, antes de qualquer regra existente.

Não apague nada do styles.css existente — apenas adicione as variáveis no topo.
```

---

## 📊 Prompt 2 — Card Top Categorias expansível no Dashboard

```
Leia os arquivos:
- design_handoff/screens/01-dashboard.md
- frontend/src/pages/DashboardPage.tsx
- frontend/src/lib/api.ts (para ver como as queries são feitas)

Implemente o componente TopCategoriesCard no DashboardPage.tsx:

1. Buscar dados de GET /v1/dashboard/category-ranking com date_from e date_to
2. Renderizar lista de até 6 categorias
3. Cada categoria é um botão clicável que expande/colapsa subcategorias inline
4. Subcategorias mostram: nome, contagem de lançamentos, valor, % da categoria
5. Botão "Ver no fluxo de caixa" dentro da expansão
6. Barra de progresso colorida com a cor da categoria
7. Badge de proveniência "real" em verde

Remover qualquer card de subcategorias separado que existir no Dashboard.

Seguir o padrão de componentes e estilos já usados no DashboardPage.tsx.
```

---

## 📱 Prompt 3 — Settings mobile (navegação iOS)

```
Leia os arquivos:
- design_handoff/screens/14-settings.md
- frontend/src/pages/SettingsPage.tsx

Implemente a navegação mobile nas configurações:

1. Em telas ≤ 880px: mostrar lista de itens com chevron à direita
2. Ao tocar num item: mostrar o painel em tela cheia
3. No topo do painel: botão "← Configurações" para voltar à lista
4. Em telas > 880px: manter o layout atual (sidebar 240px + painel)

Criar um hook useMediaQuery local no arquivo se não existir.
Não usar bibliotecas externas — só React + CSS.
```

---

## 🔄 Prompt 4 — Fechar MVP 1: importação TXT/CSV end-to-end

```
Leia os arquivos:
- aidlc-docs/09-mvp-technical-contract.md  (seção "Fluxo de Importação")
- backend/app/api/routes/imports.py
- backend/app/db/models.py
- backend/app/domain/imports.py

Implemente a rota POST /v1/imports completa seguindo o contrato:

1. Validar token e resolver workspace_id
2. Validar extensão (.txt ou .csv — rejeitar PDF com mensagem)
3. Calcular SHA-256 do arquivo
4. Verificar duplicidade (unique por workspace_id + content_hash)
5. Fazer upload para Supabase Storage em {workspace_id}/{source_file_id}/{filename}
6. Criar SourceFile no banco
7. Criar ImportJob com status "processing"
8. Detectar layout (TXT conta corrente vs CSV fatura)
9. Gravar RawTransactionLines
10. Parsear cada linha com tratamento de erros por linha
11. Persistir Transactions válidas com dedupe
12. Persistir ImportErrors para linhas inválidas
13. Aplicar CategorizationRules ativas
14. Atualizar ImportJob com status final e contadores

Seguir exatamente o formato de resposta do contrato.
Não quebrar testes existentes em backend/tests/.
```

---

## 📈 Prompt 5 — Endpoint category-ranking com subcategorias

```
Leia os arquivos:
- backend/app/api/routes/dashboard.py
- backend/app/db/models.py
- design_handoff/screens/01-dashboard.md (seção "Dados necessários da API")

O endpoint GET /v1/dashboard/category-ranking precisa retornar subcategorias.

Modifique o endpoint para incluir no retorno:
{
  "categories": [
    {
      "category_id": "uuid",
      "label": "Moradia",
      "color": "#3567b8",        // cor padrão por nome de categoria
      "total": 3840.00,
      "share": 28.4,
      "delta_pct": 12.0,         // variação vs período anterior (pode ser null)
      "subcategories": [
        {
          "label": "Aluguel",
          "total": 2200.00,
          "share_of_parent": 57.3,
          "transaction_count": 1
        }
      ]
    }
  ]
}

Subcategorias = agrupamento por category.name das categorias filhas
(parent_category_id = categoria principal).

Manter retrocompatibilidade — os campos existentes não devem mudar.
```

---

## 🔐 Prompt 6 — Auth flow completo

```
Leia os arquivos:
- frontend/src/App.tsx (LoginScreen e handleSession)
- frontend/src/lib/api.ts
- backend/app/api/routes/auth.py
- backend/app/core/config.py

Verifique se o fluxo de autenticação está completo:
1. Login via Supabase Auth retorna access_token
2. Frontend guarda token em localStorage (chave scf_token)
3. Todas as chamadas de API enviam Authorization: Bearer <token>
4. Backend valida o token Supabase em cada rota protegida
5. Workspace é criado automaticamente no primeiro acesso

Se algum passo estiver faltando, implemente.
Se tudo estiver ok, me diga o que testou.
```

---

## 🧪 Prompt 7 — Rodar testes e corrigir falhas

```
Leia os arquivos em backend/tests/.

Liste todos os testes existentes.
Identifique quais estão passando e quais estão falhando (lendo o código, sem executar).
Para os que estiverem falhando ou incompletos, implemente as correções necessárias.

Foque primeiro nos testes obrigatórios do MVP 1 listados em
aidlc-docs/09-mvp-technical-contract.md (seção "Testes Obrigatórios").
```

---

## 💡 Dicas de uso no Claude Desktop

1. **Sempre comece** com o Prompt de contexto inicial antes de qualquer outro
2. **Um prompt por vez** — não junte vários prompts numa única mensagem
3. **Peça confirmação** antes de aplicar: "me mostra o diff antes de salvar"
4. **Após cada mudança**: `npm run dev` no terminal para testar o frontend
5. **Backend**: `uvicorn app.main:app --reload` na pasta `backend/`
6. **Se der erro**: cole o erro de volta no Claude Desktop com "corrija este erro:"

---

## 📋 Ordem sugerida de execução

```
1. Prompt contexto inicial
2. Prompt 1 (tokens Tailwind)
3. Prompt 4 (MVP 1 backend — importação)
4. Prompt 5 (category-ranking com subcategorias)
5. Prompt 2 (Dashboard top categorias)
6. Prompt 3 (Settings mobile)
7. Prompt 6 (Auth flow)
8. Prompt 7 (Testes)
```
