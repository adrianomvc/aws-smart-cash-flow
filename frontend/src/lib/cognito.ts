import { Amplify } from "aws-amplify";
import {
  confirmResetPassword, confirmSignIn, confirmSignUp, fetchAuthSession,
  resendSignUpCode, resetPassword, signIn, signOut, signUp,
} from "aws-amplify/auth";

import { setCognitoTokenProvider } from "./api";

const region = import.meta.env.VITE_COGNITO_REGION as string | undefined;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const userPoolClientId = import.meta.env.VITE_COGNITO_APP_CLIENT_ID as string | undefined;

export const cognitoConfigured = Boolean(region && userPoolId && userPoolClientId);

if (cognitoConfigured) {
  Amplify.configure({
    Auth: { Cognito: { userPoolId: userPoolId!, userPoolClientId: userPoolClientId! } },
  });
  // Let the API layer fetch a fresh ID token (auto-refreshed) for each request.
  setCognitoTokenProvider(getCognitoIdToken);
}

export async function getCognitoIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export type SignInResult =
  | { status: "done"; idToken: string }
  | { status: "mfa" }
  | { status: "mfa_setup"; secret: string }
  | { status: "new_password" };

async function resolveStep(res: { isSignedIn: boolean; nextStep?: { signInStep?: string; totpSetupDetails?: { sharedSecret?: string } } }): Promise<SignInResult> {
  const step = res.nextStep?.signInStep;
  if (res.isSignedIn || step === "DONE") {
    const idToken = await getCognitoIdToken();
    if (!idToken) throw new Error("Não foi possível obter o token de sessão.");
    return { status: "done", idToken };
  }
  if (step === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") return { status: "mfa" };
  if (step === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
    return { status: "mfa_setup", secret: res.nextStep?.totpSetupDetails?.sharedSecret ?? "" };
  }
  if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") return { status: "new_password" };
  throw new Error(`Etapa de login não suportada: ${step}`);
}

export async function cognitoSignIn(email: string, password: string): Promise<SignInResult> {
  const res = await signIn({ username: email, password });
  return resolveStep(res);
}

export async function cognitoConfirmChallenge(code: string): Promise<SignInResult> {
  const res = await confirmSignIn({ challengeResponse: code });
  return resolveStep(res);
}

export async function cognitoSignUp(email: string, password: string, name?: string): Promise<void> {
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email, ...(name ? { name } : {}) } },
  });
}

export async function cognitoConfirmSignUp(email: string, code: string): Promise<void> {
  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function cognitoResendSignUp(email: string): Promise<void> {
  await resendSignUpCode({ username: email });
}

export async function cognitoResetPassword(email: string): Promise<void> {
  await resetPassword({ username: email });
}

export async function cognitoConfirmReset(email: string, code: string, newPassword: string): Promise<void> {
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}

export async function cognitoSignOut(): Promise<void> {
  try {
    await signOut();
  } catch {
    /* ignore */
  }
}

// Cognito raises English exceptions; surface them in pt-BR. Unknown errors fall
// back to the raw message so nothing gets swallowed.
const AUTH_ERRORS: Record<string, string> = {
  NotAuthorizedException: "E-mail ou senha incorretos.",
  UserNotFoundException: "E-mail ou senha incorretos.",
  UsernameExistsException: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  InvalidPasswordException:
    "A senha não atende aos requisitos: mínimo de 8 caracteres, com maiúscula, minúscula, número e símbolo.",
  CodeMismatchException: "Código incorreto. Confira o e-mail (e o spam) e tente novamente.",
  ExpiredCodeException: "Código expirado. Solicite um novo código.",
  LimitExceededException: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  TooManyRequestsException: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  TooManyFailedAttemptsException: "Muitas tentativas incorretas. Aguarde alguns minutos.",
  UserNotConfirmedException: "Conta ainda não confirmada — use o código enviado ao seu e-mail.",
  InvalidParameterException: "Dados inválidos. Confira os campos e tente novamente.",
};

export function translateAuthError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  // Password reset on an account whose e-mail was never verified: Cognito
  // reports it as a generic InvalidParameterException — call out the real
  // cause instead of a misleading "invalid data".
  if (e?.message?.includes("no registered/verified email")) {
    return "O e-mail desta conta ainda não foi verificado, então não é possível redefinir a senha. Peça ao administrador para verificar o e-mail no Cognito.";
  }
  if (e?.name && AUTH_ERRORS[e.name]) return AUTH_ERRORS[e.name];
  return e?.message || "Ocorreu um erro. Tente novamente.";
}
