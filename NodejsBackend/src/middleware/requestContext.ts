import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requestContext(_req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function requestIdFor(res: Response): string | undefined {
  return typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;
}
