import seed from "../../data/database.json";
import {
  User, Declaration, WorkflowInstance, WorkflowRule,
  SystemConfig, Dropdowns, ComplianceTrendPoint, TypeBreakdownItem,
} from "../../types/declaration";

const DB_KEY = "ghe.db";

interface Database {
  config: SystemConfig;
  users: User[];
  declarations: Declaration[];
  workflowRules: WorkflowRule[];
  workflowInstances: WorkflowInstance[];
  dropdowns: Dropdowns;
  complianceTrend: ComplianceTrendPoint[];
  typeBreakdown: TypeBreakdownItem[];
  approvalOptions: { value: string; label: string }[];
}

function load(): Database {
  if (typeof window === "undefined") return seed as unknown as Database;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Database;
      return {
        ...seed,
        ...stored,
        config: { ...seed.config, ...stored.config },
        users: mergeSeedPriority(seed.users, stored.users, "id", ["role"]),
        declarations: mergeArray(seed.declarations, stored.declarations, "id"),
        workflowInstances: mergeArray(
          seed.workflowInstances as WorkflowInstance[],
          stored.workflowInstances || [],
          "declarationId"
        ),
      };
    }
  } catch { /* ignore */ }
  return seed as unknown as Database;
}

function mergeArray<T extends Record<string, unknown>>(seed: T[], stored: T[], key: keyof T): T[] {
  const map = new Map<string, T>();
  for (const item of seed) map.set(String(item[key]), item);
  for (const item of stored) map.set(String(item[key]), item);
  return Array.from(map.values());
}

function mergeSeedPriority<T extends Record<string, unknown>>(
  seed: T[],
  stored: T[],
  key: keyof T,
  priorityFields: (keyof T)[]
): T[] {
  const map = new Map<string, T>();
  for (const item of seed) map.set(String(item[key]), item);
  for (const item of stored) {
    const mapKey = String(item[key]);
    const existing = map.get(mapKey);
    if (existing) {
      const merged = { ...item };
      for (const field of priorityFields) {
        (merged as Record<string, unknown>)[field as string] = existing[field];
      }
      map.set(mapKey, merged);
    } else {
      map.set(mapKey, item);
    }
  }
  return Array.from(map.values());
}

function save(db: Database) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

let cache: Database | null = null;

function get(): Database {
  if (!cache) cache = load();
  return cache;
}

function persist() {
  if (cache) save(cache);
}

export function invalidateCache() {
  cache = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", () => {
    invalidateCache();
  });
}

export { get, persist };