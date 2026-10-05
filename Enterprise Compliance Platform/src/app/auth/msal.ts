import { PublicClientApplication, type AccountInfo, type AuthenticationResult } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
const authority = import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined;
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined;
if (!clientId || !authority || !apiScope) throw new Error("Missing Entra frontend configuration");

export const loginRequest = { scopes: ["openid", "profile", "email", apiScope] };
export const msal = new PublicClientApplication({ auth: { clientId, authority, redirectUri, postLogoutRedirectUri: redirectUri }, cache: { cacheLocation: "sessionStorage" } });
export async function initializeIdentity(): Promise<void> { await msal.initialize(); const result = await msal.handleRedirectPromise(); if (result?.account) msal.setActiveAccount(result.account); if (!msal.getActiveAccount()) { const account = msal.getAllAccounts()[0]; if (account) msal.setActiveAccount(account); } }
export function activeAccount(): AccountInfo | null { return msal.getActiveAccount(); }
export async function signIn(): Promise<AuthenticationResult | void> { return msal.loginRedirect(loginRequest); }
export async function getApiToken(): Promise<string> { const account = activeAccount(); if (!account) throw new Error("No authenticated Entra account"); return (await msal.acquireTokenSilent({ ...loginRequest, account })).accessToken; }
export function signOut(): void { void msal.logoutRedirect(); }
