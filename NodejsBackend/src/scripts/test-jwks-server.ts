import { startTestJwksServer } from "../test-utils/test-jwks-server";

async function main() {
  const provider = await startTestJwksServer();
  const shutdown = async () => {
    await provider.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main().catch((error: unknown) => {
  console.error("Failed to start the test JWKS provider:", error);
  process.exitCode = 1;
});
