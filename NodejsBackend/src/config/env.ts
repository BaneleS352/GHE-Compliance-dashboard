function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: (() => { const p = parseInt(process.env.PORT || "3001", 10); return Number.isFinite(p) ? p : 3001; })(),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: "7d",
};
