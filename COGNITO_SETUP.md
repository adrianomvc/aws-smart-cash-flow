# Autenticação com Amazon Cognito

Guia para ligar login real (senha, 2FA por app, sessões via token) usando
**Amazon Cognito User Pools**. Free tier: **50.000 usuários ativos/mês** — para
uma família, custo **R$ 0**. (2FA por SMS custa via SNS; 2FA por app TOTP é grátis.)

O **backend já valida tokens Cognito** (ID token, RS256, via JWKS). Só falta você
criar o User Pool e configurar as variáveis. O frontend ainda precisa da tela de
login com Amplify (fase 2 — ver no fim).

## 1. Criar o User Pool (console AWS)

1. **Cognito → Create user pool**.
2. **Sign-in options:** marque **Email** (login por e-mail).
3. **Password policy:** padrão (ou ajuste o mínimo de caracteres).
4. **MFA:** escolha **Optional** (ou Required) e marque **Authenticator apps (TOTP)**
   — grátis. (SMS é pago; deixe desmarcado por enquanto.)
5. **Self-service sign-up:** habilite se quiser que membros se cadastrem sozinhos.
6. **Email:** use o "Send email with Cognito" (free, baixo volume) por enquanto.
7. **App client:**
   - Tipo **Public client** (SPA) — **sem client secret**.
   - Auth flows: habilite **ALLOW_USER_SRP_AUTH** e **ALLOW_REFRESH_TOKEN_AUTH**.
8. Anote: **Region** (ex.: `us-east-1`), **User pool ID** (ex.: `us-east-1_AbC123`),
   **App client ID** (ex.: `1h2j3...`).

## 2. Variáveis de ambiente

### Backend (`backend/.env`)
```
APP_ENV=production            # qualquer valor != "local" desliga o bypass local-dev
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_AbC123
COGNITO_APP_CLIENT_ID=1h2j3kxxxxxxxxxxxxxxxxxxxx
```
Quando `COGNITO_USER_POOL_ID` e `COGNITO_REGION` estão setados, todo `Bearer <token>`
é validado como **ID token** do Cognito (assinatura RS256 contra o JWKS do pool,
`iss` e `aud` conferidos). O `sub` vira o `user_id` e o `email` vem do token.

> No ambiente local (`APP_ENV=local`) o atalho `Bearer local-dev` continua funcionando
> e o Cognito fica desligado — útil para desenvolvimento.

### Frontend (`frontend/.env`)
```
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_AbC123
VITE_COGNITO_APP_CLIENT_ID=1h2j3kxxxxxxxxxxxxxxxxxxxx
```

## 3. Como o app usa

- O frontend faz login no Cognito (senha + MFA), recebe o **ID token (JWT)** e o
  envia como `Authorization: Bearer <idToken>` em todas as chamadas (`ApiSession.mode = "cognito"`).
- O backend valida e resolve o usuário/workspace pelo `sub` (cria o usuário na
  primeira vez, como já faz hoje via `WorkspaceService`).
- Papéis e membros (tela Família) continuam funcionando: cada `sub` do Cognito é um
  `User`; o convite por e-mail passa a poder ser aceito quando a pessoa logar com
  aquele e-mail.

## 4. O que é grátis vs pago
- ✅ Senha, cadastro, reset, política de senha — grátis.
- ✅ 2FA por **app autenticador (TOTP)** — grátis.
- ✅ Sessões via token (access/ID/refresh), logout, revogação — grátis.
- ✅ Login social (Google/Apple) — grátis.
- 💲 2FA por **SMS** — pago (SNS, centavos/mensagem).
- ⚠️ Tela de "sessões ativas por dispositivo/cidade" (como no protótipo) não é nativa
  — exige logging próprio. O básico (sessão atual + revogar refresh tokens) é nativo.

## 5. Fase 2 — login no frontend (a fazer)
Falta plugar o **AWS Amplify Auth** (`npm i aws-amplify`) na `LoginScreen`:
`signIn` (com challenge de MFA), `signUp`, `resetPassword`, e no sucesso chamar
`onLogin({ token: idToken, mode: "cognito" })`. Isso só dá para testar de verdade
após o User Pool existir. Quando você criar o pool e me passar region/poolId/clientId
(não são segredos), eu faço a tela de login.
