import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const productionRoots = [path.join(root, "src", "app"), path.join(root, "src", "shell"), path.join(root, "src", "services")];
const sourceFiles = productionRoots.flatMap((sourceRoot) => {
  if (!fs.existsSync(sourceRoot)) return [];
  return fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
});

const sourceByAbsolutePath = new Set(sourceFiles.map((file) => path.resolve(file)));
const extensions = [".ts", ".tsx"];
function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, ...extensions.map((extension) => `${base}${extension}`), ...extensions.map((extension) => path.join(base, `index${extension}`))];
  return candidates.map((candidate) => path.resolve(candidate)).find((candidate) => sourceByAbsolutePath.has(candidate)) ?? null;
}

const dependencyGraph = new Map(sourceFiles.map((file) => [path.resolve(file), []]));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const imports = [...source.matchAll(/(?:import|export)\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g)];
  dependencyGraph.set(path.resolve(file), imports.flatMap((match) => {
    const resolved = resolveImport(file, match[1]);
    return resolved ? [resolved] : [];
  }));
}

const cycleViolations = [];
const visiting = new Set();
const visited = new Set();
const stack = [];
function visit(file) {
  if (visiting.has(file)) {
    const cycleStart = stack.indexOf(file);
    cycleViolations.push(stack.slice(cycleStart).concat(file).map((item) => path.relative(root, item)).join(" -> "));
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  stack.push(file);
  for (const dependency of dependencyGraph.get(file) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}
for (const file of dependencyGraph.keys()) visit(file);

if (cycleViolations.length > 0) {
  console.error("Quality gate failed: circular production dependencies detected:");
  [...new Set(cycleViolations)].forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

// `any` in production code removes compiler protection at domain and UI
// boundaries. Tests may use narrowly scoped casts, but shipped source may not.
const forbiddenAny = /:\s*any\b|\bas\s+any\b|<any(?:\[\])?>|\bany\[\]/;
const violations = sourceFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => forbiddenAny.test(line) ? [`${path.relative(root, file)}:${index + 1}`] : []);
});
if (violations.length > 0) {
  console.error("Quality gate failed: production source contains forbidden any types:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

const deepImportViolations = sourceFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => /from\s+["']\.\.\/\.\.\/\.\.\//.test(line)
    ? [`${path.relative(root, file)}:${index + 1}`]
    : []);
});
if (deepImportViolations.length > 0) {
  console.error("Quality gate failed: production source contains deep relative imports; use the @/ alias:");
  deepImportViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

const serviceBoundaryViolations = sourceFiles.flatMap((file) => {
  if (!file.includes(`${path.sep}src${path.sep}services${path.sep}`)) return [];
  const source = fs.readFileSync(file, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => /from\s+["'](?:@\/app|\.\.\/.*app)/.test(line)
    ? [`${path.relative(root, file)}:${index + 1}`]
    : []);
});
if (serviceBoundaryViolations.length > 0) {
  console.error("Quality gate failed: service modules must not depend on app/auth or UI modules:");
  serviceBoundaryViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

const pageBoundaryViolations = sourceFiles.flatMap((file) => {
  if (!file.includes(`${path.sep}src${path.sep}app${path.sep}pages${path.sep}`)) return [];
  const source = fs.readFileSync(file, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => /from\s+["'](?:@\/app\/pages|\.\.\/.*pages)/.test(line)
    ? [`${path.relative(root, file)}:${index + 1}`]
    : []);
});
if (pageBoundaryViolations.length > 0) {
  console.error("Quality gate failed: page modules must not import other page modules; move shared views to app/components:");
  pageBoundaryViolations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

const forbiddenBrowserSideChannels = sourceFiles.flatMap((file) => {
  const relative = path.relative(root, file);
  const source = fs.readFileSync(file, "utf8");
  return source.split(/\r?\n/).flatMap((line, index) => {
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return [];
    const directFetch = /^\s*(?:await\s+)?fetch\s*\(/.test(line) && !relative.includes(`${path.sep}src${path.sep}services${path.sep}`);
    const nativeDialog = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(line);
    const unapprovedConsole = /\bconsole\.(?:error|warn|log)\s*\(/.test(line) && !relative.endsWith("clientTelemetry.ts");
    return directFetch || nativeDialog || unapprovedConsole ? [`${relative}:${index + 1}`] : [];
  });
});
if (forbiddenBrowserSideChannels.length > 0) {
  console.error("Quality gate failed: use shared services, dialogs, and telemetry for browser side channels:");
  forbiddenBrowserSideChannels.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log("Quality gate passed: no forbidden any types, deep relative imports, page/service boundary violations, browser side channels, or circular production dependencies.");
