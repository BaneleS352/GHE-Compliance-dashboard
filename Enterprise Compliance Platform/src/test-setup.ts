import "@testing-library/jest-dom";
import { configureApiTokenProvider } from "@/services/authToken";

configureApiTokenProvider(async () => {
  const { getApiToken } = await import("@/app/auth/msal");
  return getApiToken();
});
