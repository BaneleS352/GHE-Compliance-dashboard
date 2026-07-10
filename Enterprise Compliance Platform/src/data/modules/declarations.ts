import { Declaration } from "../../types/declaration";
import { get, persist } from "../db";

export function getDeclarations(): Declaration[] {
  return get().declarations;
}

export function getDeclarationsByEmployee(employeeId: string): Declaration[] {
  return get().declarations.filter((d) => d.employeeId === employeeId);
}

export function getDeclarationById(id: string): Declaration | undefined {
  return get().declarations.find((d) => d.id === id);
}

export function addDeclaration(declaration: Declaration) {
  const db = get();
  if (db.declarations.some((d) => d.id === declaration.id)) {
    throw new Error(`Declaration with ID "${declaration.id}" already exists.`);
  }
  if (!Number.isFinite(declaration.value) || declaration.value < 0) {
    throw new Error("Declaration value must be a non-negative number.");
  }
  if (!declaration.employee || !declaration.type || !declaration.Counterparty) {
    throw new Error("Employee, type, and counterparty are required.");
  }
  if (declaration.description && declaration.description.length > 10000) {
    throw new Error("Description too long (max 10000 characters).");
  }
  db.declarations.push(declaration);
  persist();
  return declaration;
}

export function updateDeclaration(id: string, updates: Partial<Declaration>) {
  const db = get();
  const idx = db.declarations.findIndex((d) => d.id === id);
  if (idx === -1) {
    throw new Error(`Declaration with id "${id}" not found.`);
  }
  const current = db.declarations[idx];
  if (updates.status && !["Draft", "Pending", "Approved", "Declined", "Escalated", "Info Requested"].includes(updates.status)) {
    throw new Error(`Invalid status: "${updates.status}". Must be one of: Draft, Pending, Approved, Declined, Escalated, Info Requested.`);
  }
  if (updates.value !== undefined) {
    if (!Number.isFinite(updates.value) || updates.value < 0) {
      throw new Error("Value must be a non-negative number.");
    }
    if (String(updates.value).length > 20) {
      throw new Error("Value is too large.");
    }
  }
  if (updates.employee && String(updates.employee).length > 200) {
    throw new Error("Employee name too long (max 200 characters).");
  }
  if (updates.Counterparty && String(updates.Counterparty).length > 200) {
    throw new Error("Counterparty too long (max 200 characters).");
  }
  if (updates.description && String(updates.description).length > 10000) {
    throw new Error("Description too long (max 10000 characters).");
  }
  db.declarations[idx] = { ...current, ...updates };
  persist();
}