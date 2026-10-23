export type ApiTokenProvider = () => Promise<string>;

let provider: ApiTokenProvider | null = null;

export function configureApiTokenProvider(nextProvider: ApiTokenProvider): void {
  provider = nextProvider;
}

export async function getApiToken(): Promise<string> {
  if (!provider) {
    throw new Error("API token provider has not been configured");
  }
  return provider();
}
