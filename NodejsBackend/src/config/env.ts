function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: "7d",
};
