const QUICK_LOGIN_USERS = [
  { email: "nomvula@hb.co.za", name: "Nomvula Dlamini" },
  { email: "sipho@hb.co.za", name: "Sipho Nkosi" },
  { email: "lindiwe@hb.co.za", name: "Lindiwe Zulu" },
  { email: "admin@hb.co.za", name: "Admin User" },
] as const;

/** Mint a real test-provider token for a seeded local account (development only). */
export async function quickLogin(email: string): Promise<void> {
  if (!import.meta.env.DEV) throw new Error("Quick login is available only in development.");

  const user = QUICK_LOGIN_USERS.find((candidate) => candidate.email === email);
  if (!user) throw new Error("Unknown quick-login account.");

  const response = await fetch("/__dev-auth/test-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      name: user.name,
      // Match the stable local test subject used by the Playwright identity
      // harness so an account linked during E2E can be reused by quick login.
      oid: `test-oid-e2e-${user.email}`,
    }),
  });
  if (!response.ok) throw new Error(`Test identity provider returned ${response.status}.`);

  const token = (await response.text()).trim();
  if (!token) throw new Error("Test identity provider returned an empty token.");

  const identityResponse = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (identityResponse.status === 403) {
    throw new Error("This local account is linked to a different identity. Use a fresh local test account or database.");
  }
  if (!identityResponse.ok) throw new Error("The API could not authenticate the selected test account.");

  sessionStorage.setItem("e2e.auth.token", token);
  window.location.assign("/");
}
