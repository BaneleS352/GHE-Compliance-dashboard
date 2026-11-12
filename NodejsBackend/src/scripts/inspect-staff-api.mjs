import "dotenv/config";

const DEFAULT_HOST = "his-api-uat.betsolutions.net";
const TIMEOUT_MS = 20_000;

function lookupArgument() {
  const hasAnyLookupFlag = ["--employee-id", "--email", "--name"].some((flag) =>
    process.argv.includes(flag) || process.argv.some((arg) => arg.startsWith(`${flag}=`)),
  );
  if (hasAnyLookupFlag) {
    const lookup = new URLSearchParams();
    const readOption = (flag) => {
      const index = process.argv.indexOf(flag);
      const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
      return (index >= 0 ? process.argv[index + 1] : inline?.slice(flag.length + 1))?.trim();
    };
    const employeeId = readOption("--employee-id");
    const email = readOption("--email");
    const name = readOption("--name");
    if (employeeId !== undefined) {
      if (!/^\d+$/.test(employeeId)) throw new Error("--employee-id must contain digits only.");
      lookup.set("employeeId", employeeId);
    }
    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email must be a valid email address.");
      lookup.set("email", email);
    }
    if (name !== undefined) {
      if (!name) throw new Error("--name cannot be empty.");
      lookup.set("name", name);
    }
    if (lookup.size === 0) throw new Error("Provide at least one nonempty lookup parameter.");
    return lookup;
  }

  const employeeIndex = process.argv.indexOf("--employee-id");
  const employeeInline = process.argv.find((arg) => arg.startsWith("--employee-id="));
  const employeeId = (employeeIndex >= 0 ? process.argv[employeeIndex + 1] : employeeInline?.slice("--employee-id=".length))?.trim();
  if (employeeId !== undefined) {
    if (!/^\d+$/.test(employeeId)) throw new Error("--employee-id must contain digits only.");
    return { key: "employeeId", value: employeeId };
  }

  const index = process.argv.indexOf("--email");
  const inline = process.argv.find((arg) => arg.startsWith("--email="));
  const value = (index >= 0 ? process.argv[index + 1] : inline?.slice("--email=".length))
    || process.env.STAFF_API_EMAIL;
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Provide --employee-id, --email, and/or --name, or STAFF_API_EMAIL in NodejsBackend/.env.");
  }
  return new URLSearchParams({ email: value.trim() });
}

function responseShape(value, path = "$", depth = 0) {
  if (depth > 8) return [`${path}: (depth limit)`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${path}: array (empty)`];
    return [`${path}: array (${value.length} item${value.length === 1 ? "" : "s"})`, ...responseShape(value[0], `${path}[]`, depth + 1)];
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return [`${path}: object (empty)`];
    return entries.flatMap(([key, child]) => responseShape(child, `${path}.${key}`, depth + 1));
  }
  return [`${path}: ${value === null ? "null" : typeof value}`];
}

async function main() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    console.warn("NODE_TLS_REJECT_UNAUTHORIZED=0 was set; this request is forcing verified TLS.");
  }

  const endpointSetting = process.env.STAFF_API_ENDPOINT?.trim();
  if (!endpointSetting) throw new Error("STAFF_API_ENDPOINT is missing from NodejsBackend/.env.");

  let endpoint;
  try {
    endpoint = new URL(endpointSetting);
  } catch {
    throw new Error("STAFF_API_ENDPOINT must be a plain URL, not a Markdown link.");
  }
  if (endpoint.protocol !== "https:" || endpoint.hostname.toLowerCase() !== DEFAULT_HOST) {
    throw new Error(`STAFF_API_ENDPOINT must use HTTPS on ${DEFAULT_HOST}.`);
  }
  if (endpoint.username || endpoint.password) throw new Error("Do not put credentials in STAFF_API_ENDPOINT.");

  const lookup = lookupArgument();
  for (const [key, value] of lookup) endpoint.searchParams.set(key, value);

  const headers = { accept: "*/*" };
  const token = process.env.AUTH_TOKEN?.trim();
  if (token) {
    const headerName = process.env.AUTH_TOKEN_HEADER?.trim() || "Authorization";
    const scheme = process.env.AUTH_TOKEN_SCHEME?.trim() ?? "Bearer";
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName)) {
      throw new Error("AUTH_TOKEN_HEADER is not a valid HTTP header name.");
    }
    const value = scheme && !/^\S+\s/.test(token) ? `${scheme} ${token}` : token;
    headers[headerName] = value;
  }

  console.log(`GET ${endpoint.origin}${endpoint.pathname}${endpoint.search}`);
  console.log(`Authorization header: ${token ? "included (value hidden)" : "not sent"}`);

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.text();
  console.log(`HTTP ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${response.headers.get("content-type") || "not provided"}`);

  if (!body.trim()) {
    console.log("Response body: (empty)");
  } else {
    try {
      const data = JSON.parse(body);
      console.log("Response field paths and types:");
      for (const line of responseShape(data)) console.log(`  ${line}`);
      console.log("Response JSON:");
      console.log(JSON.stringify(data, null, 2));
    } catch {
      console.log("Response body:");
      console.log(body);
    }
  }

  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "request failed";
  console.error(`HIS staff lookup failed: ${message}`);
  process.exitCode = 1;
});
