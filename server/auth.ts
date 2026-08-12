import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const tokenDays = 30;

function authUser() {
  return process.env.APP_LOGIN_USER;
}

function authPassword() {
  return process.env.APP_LOGIN_PASSWORD;
}

function sessionSecret() {
  return process.env.APP_SESSION_SECRET;
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("APP_SESSION_SECRET is missing.");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createSessionToken(username: string) {
  const expiresAt = Date.now() + tokenDays * 24 * 60 * 60 * 1000;
  const payload = base64Url(JSON.stringify({ sub: username, exp: expiresAt }));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) return null;
    return { username: parsed.sub, expiresAt: parsed.exp };
  } catch {
    return null;
  }
}

export function login(request: Request, response: Response) {
  const configuredUser = authUser();
  const configuredPassword = authPassword();
  if (!configuredUser || !configuredPassword || !sessionSecret()) {
    return response.status(500).json({ error: "Login is not configured. Set APP_LOGIN_USER, APP_LOGIN_PASSWORD, and APP_SESSION_SECRET in .env.local." });
  }
  const username = String(request.body?.username ?? "");
  const password = String(request.body?.password ?? "");
  if (!safeEqual(username, configuredUser) || !safeEqual(password, configuredPassword)) {
    return response.status(401).json({ error: "Wrong username or password." });
  }
  response.json({ username, token: createSessionToken(username) });
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = verifySessionToken(token);
  if (!session) return response.status(401).json({ error: "Login required." });
  response.locals.user = session.username;
  next();
}
