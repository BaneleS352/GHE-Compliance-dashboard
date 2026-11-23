import { Router, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticateAndSyncStaff, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { toDbId, toJsonId } from "../services/ids";
import { createHash, randomBytes } from "node:crypto";
import { hashLocalPassword, verifyLocalPassword, createOtp, LocalOtpInbox } from "../services/localAuth";
import { signLocalAccessToken } from "../services/localIdentity";
import { config } from "../config/env";
import { rateLimit } from "express-rate-limit";

const router = Router();
const localOtpInbox = new LocalOtpInbox();
const localRateLimitHandler = (_req: Request, res: Response): void => {
  res.status(429).json({ error: "Too many authentication attempts. Please try again later." });
};
const localStartLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: localRateLimitHandler });
const localVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: localRateLimitHandler });
function resetLocalAuthLimits(req: Request): void {
  const key = req.ip;
  if (key) { localStartLimiter.resetKey(key); localVerifyLimiter.resetKey(key); }
}

router.post("/local/start", localStartLimiter, asyncHandler(async (req, res): Promise<void> => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!/^\d+$/.test(employeeId) || !password) { res.status(400).json({ error: "Employee ID and password are required" }); return; }
  const user = await prisma.user.findUnique({ where: { id: toDbId(employeeId) }, select: { id: true, email: true, name: true, role: true, phoneNumber: true, passwordHash: true, localAuthEnabled: true, isActive: true } });
  if (!user || !user.localAuthEnabled || !user.isActive || !user.passwordHash || !(await verifyLocalPassword(password, user.passwordHash))) { res.status(401).json({ error: "Invalid employee ID or password" }); return; }
  if (!user.phoneNumber) { res.status(403).json({ error: "This account has no phone number configured" }); return; }
  const { code, expiresAt } = createOtp();
  const challengeId = randomBytes(24).toString("base64url");
  await prisma.localAuthChallenge.create({ data: { id: challengeId, userId: user.id, otpHash: createHash("sha256").update(code).digest("hex"), expiresAt } });
  await prisma.localAuthEvent.create({ data: { userId: user.id, action: "otp_sent", metadata: { destinationLast4: user.phoneNumber.slice(-4) } } });
  await localOtpInbox.send({ destination: user.phoneNumber, code, expiresAt, createdAt: new Date(), purpose: "login" });
  res.status(202).json({ challengeId, expiresAt: expiresAt.toISOString(), phoneHint: `••••${user.phoneNumber.slice(-4)}` });
}));

router.post("/local/forgot-password", localStartLimiter, asyncHandler(async (req, res): Promise<void> => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId.trim() : "";
  const challengeId = randomBytes(24).toString("base64url");
  const user = /^\d+$/.test(employeeId) ? await prisma.user.findUnique({ where: { id: toDbId(employeeId) }, select: { id: true, phoneNumber: true, localAuthEnabled: true, isActive: true } }) : null;
  if (user?.localAuthEnabled && user.isActive && user.phoneNumber) {
    const { code, expiresAt } = createOtp();
    await prisma.localAuthChallenge.create({ data: { id: challengeId, userId: user.id, purpose: "password_reset", otpHash: createHash("sha256").update(code).digest("hex"), expiresAt } });
    await prisma.localAuthEvent.create({ data: { userId: user.id, action: "password_reset_otp_sent", metadata: { destinationLast4: user.phoneNumber.slice(-4) } } });
    await localOtpInbox.send({ destination: user.phoneNumber, code, expiresAt, createdAt: new Date(), purpose: "password_reset" });
  }
  res.status(202).json({ message: "If the employee account is eligible, a verification code has been sent.", challengeId });
}));

router.post("/local/forgot-password/verify", localVerifyLimiter, asyncHandler(async (req, res): Promise<void> => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const challenge = await prisma.localAuthChallenge.findUnique({ where: { id: challengeId }, include: { user: { select: { id: true, email: true, name: true, role: true, localAuthEnabled: true, isActive: true } } } });
  if (!challenge || challenge.purpose !== "password_reset" || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= 10 || !challenge.user.localAuthEnabled || !challenge.user.isActive) { res.status(401).json({ error: "Invalid or expired verification code" }); return; }
  await prisma.localAuthChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
  if (createHash("sha256").update(code).digest("hex") !== challenge.otpHash) { res.status(401).json({ error: "Invalid or expired verification code" }); return; }
  const passwordHash = await hashLocalPassword(newPassword).catch(() => null);
  if (!passwordHash) { res.status(400).json({ error: "Password must be between 12 and 128 characters" }); return; }
  await prisma.localAuthChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
  await prisma.user.update({ where: { id: challenge.userId }, data: { passwordHash, passwordEnrollmentRequired: false } });
  await prisma.localAuthEvent.create({ data: { userId: challenge.userId, action: "password_reset_completed" } });
  resetLocalAuthLimits(req);
  res.json({ accessToken: await signLocalAccessToken({ subject: challenge.user.id.toString(), email: challenge.user.email, name: challenge.user.name, role: challenge.user.role }) });
}));

router.post("/local/verify", localVerifyLimiter, asyncHandler(async (req, res): Promise<void> => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const challenge = await prisma.localAuthChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= 5) { res.status(401).json({ error: "Invalid or expired verification code" }); return; }
  await prisma.localAuthChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 } } });
  const valid = createHash("sha256").update(code).digest("hex") === challenge.otpHash;
  if (!valid) { await prisma.localAuthEvent.create({ data: { userId: challenge.userId, action: "otp_failed" } }); res.status(401).json({ error: "Invalid or expired verification code" }); return; }
  await prisma.localAuthChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, select: { id: true, email: true, name: true, role: true, passwordEnrollmentRequired: true } });
  if (!user) { res.status(401).json({ error: "Account is no longer available" }); return; }
  await prisma.localAuthEvent.create({ data: { userId: user.id, action: "otp_verified" } });
  if (user.passwordEnrollmentRequired) { res.json({ enrollmentRequired: true, enrollmentToken: challengeId }); return; }
  resetLocalAuthLimits(req);
  res.json({ accessToken: await signLocalAccessToken({ subject: user.id.toString(), email: user.email, name: user.name, role: user.role }) });
}));

router.post("/local/enroll", localVerifyLimiter, asyncHandler(async (req, res): Promise<void> => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  const enrollmentToken = typeof req.body?.enrollmentToken === "string" ? req.body.enrollmentToken : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!enrollmentToken || !newPassword) { res.status(400).json({ error: "Enrollment token and new password are required" }); return; }
  let passwordHash: string;
  try { passwordHash = await hashLocalPassword(newPassword); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid password" }); return; }
  const challenge = await prisma.localAuthChallenge.findUnique({ where: { id: enrollmentToken }, include: { user: { select: { id: true, email: true, name: true, role: true, passwordEnrollmentRequired: true, localAuthEnabled: true, isActive: true } } } });
  if (!challenge || !challenge.consumedAt || challenge.user.passwordEnrollmentRequired !== true || !challenge.user.localAuthEnabled || !challenge.user.isActive) { res.status(401).json({ error: "Invalid enrollment token" }); return; }
  const user = await prisma.user.update({ where: { id: challenge.userId }, data: { passwordHash, passwordEnrollmentRequired: false }, select: { id: true, email: true, name: true, role: true } });
  await prisma.localAuthEvent.create({ data: { userId: user.id, action: "password_enrolled" } });
  resetLocalAuthLimits(req);
  res.json({ accessToken: await signLocalAccessToken({ subject: user.id.toString(), email: user.email, name: user.name, role: user.role }) });
}));

router.get("/local/inbox", (_req, res) => {
  if (!config.localAuth.enabled) { res.status(404).json({ error: "Not found" }); return; }
  res.json(localOtpInbox.messages.map((message) => ({ ...message, createdAt: message.createdAt?.toISOString(), expiresAt: message.expiresAt.toISOString(), expiresAtLocal: message.expiresAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", hour12: false }), destinationLast4: message.destination.slice(-4), code: message.code })));
});

router.get("/me", authenticateAndSyncStaff, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: toDbId(req.user!.id) },
    include: { departmentRef: true, manager: { select: { name: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: toJsonId(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    teamMemberNumber: user.teamMemberNumber,
    department: user.departmentRef?.name ?? "",
    position: user.position,
    // Compatibility response field derived from the authoritative relation.
    lineManager: user.manager?.name ?? null,
    managerId: user.managerId === null ? null : toJsonId(user.managerId),
    organizationId: user.organizationId === null ? null : toJsonId(user.organizationId),
    staffBranchCode: user.staffBranchCode,
    employmentStatus: user.staffEmploymentStatus,
    employmentType: user.staffEmploymentType,
    staffProfileSyncedAt: user.staffProfileSyncedAt,
    staffTerminationDate: user.staffTerminationDate,
  });
}));

export default router;
