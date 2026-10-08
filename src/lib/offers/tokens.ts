import { createHmac, timingSafeEqual } from "node:crypto";

export function unsubscribeToken(userId: string, secret: string) {
  return createHmac("sha256", secret).update(userId).digest("base64url");
}

export function validUnsubscribeToken(userId: string, token: string, secret: string) {
  if (!secret || !userId || !token) return false;
  const expected = unsubscribeToken(userId, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
