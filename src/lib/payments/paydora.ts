import crypto from "crypto";

/**
 * Paydora Payment API
 * https://cpcs.paydora.net/api/v1
 */

export const PAYDORA_WALLET_AMOUNTS = [
  "9.99", "14.99", "19.99", "24.99", "29.99", "39.99", "49.99", "59.99",
  "99.99", "124.99", "149.99", "199.99",
];

export const PAYDORA_CARD_AMOUNTS = [
  "10.99", "11.99", "12.99", "13.99", "14.99", "17.99", "19.99", "24.99",
  "29.99", "30.99", "39.99", "49.99", "59.99", "99.99", "124.99", "129.99",
  "149.99", "199.99",
];

export const PAYDORA_CHIME_AMOUNTS = [
  "5", "7", "10", "15", "20", "25", "30", "31", "40", "50", "60", "100",
  "125", "130", "150", "200", "300", "400", "500",
];

export interface PaydoraMethod {
  id: string;
  value: string;
  name: string;
}

export interface PaydoraDeposit {
  id: string;
  referenceId: string | null;
  status: string;
  amount: number;
  paidAmount: number | null;
  paymentUrl: string | null;
  userName: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface PaydoraWithdrawal {
  id: string;
  referenceId: string | null;
  status: string;
  amount: number;
  userName: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface PaydoraWebhookEnvelope {
  event: string;
  data: {
    depositId?: string;
    withdrawalId?: string;
    referenceId?: string | null;
    status?: string;
    amount?: number;
    paidAmount?: number | null;
    userName?: string | null;
  };
  deliveryId: string;
}

function baseUrl() {
  return (process.env.PAYDORA_API_BASE_URL || "https://cpcs.paydora.net/api/v1").replace(/\/+$/, "");
}

function apiKey() {
  const key = process.env.PAYDORA_API_KEY?.trim();
  if (!key) throw new Error("PAYDORA_API_KEY is not configured");
  return key;
}

export function isPaydoraConfigured() {
  return Boolean(process.env.PAYDORA_API_KEY?.trim());
}

export function amountsForMethod(value: string): string[] {
  const v = value.toLowerCase();
  if (v === "chime") return PAYDORA_CHIME_AMOUNTS;
  if (v === "card" || v.includes("card")) return PAYDORA_CARD_AMOUNTS;
  return PAYDORA_WALLET_AMOUNTS;
}

async function paydoraFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey()}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json?.message || text.slice(0, 240) || `Paydora HTTP ${res.status}`;
    const err = new Error(message) as Error & { status: number; errors?: unknown };
    err.status = res.status;
    err.errors = json?.errors;
    throw err;
  }

  return json as T;
}

export async function getPaydoraPaymentMethods(): Promise<{
  deposits: PaydoraMethod[];
  withdrawals: PaydoraMethod[];
}> {
  return paydoraFetch("/payment-methods");
}

export async function createPaydoraDeposit(input: {
  paymentMethodId: string;
  amount: number;
  userName?: string;
  gameId?: string;
  idempotencyKey: string;
}): Promise<PaydoraDeposit> {
  const body: Record<string, unknown> = {
    paymentMethodId: input.paymentMethodId,
    amount: input.amount,
  };
  if (input.userName) body.userName = input.userName.slice(0, 100);
  if (input.gameId) body.gameId = input.gameId;

  return paydoraFetch("/deposits/create", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify(body),
  });
}

export async function getPaydoraDeposit(depositId: string): Promise<PaydoraDeposit> {
  return paydoraFetch(`/deposits/${encodeURIComponent(depositId)}`);
}

export async function createPaydoraWithdrawal(input: {
  paymentMethodId: string;
  amount: number;
  userName?: string;
  address?: string;
  chimePhoneEmail?: string;
  cardNumber?: string;
  cardValid?: string;
  payoutEmailOrPhone?: string;
  idempotencyKey: string;
}): Promise<PaydoraWithdrawal> {
  const body: Record<string, unknown> = {
    paymentMethodId: input.paymentMethodId,
    amount: input.amount,
  };
  if (input.userName) body.userName = input.userName.slice(0, 100);
  if (input.address) body.address = input.address;
  if (input.chimePhoneEmail) body.chimePhoneEmail = input.chimePhoneEmail;
  if (input.cardNumber) body.cardNumber = input.cardNumber;
  if (input.cardValid) body.cardValid = input.cardValid;
  if (input.payoutEmailOrPhone) body.payoutEmailOrPhone = input.payoutEmailOrPhone;

  return paydoraFetch("/withdrawals/create", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify(body),
  });
}

export function verifyPaydoraSignature(rawBody: Buffer | string, signatureHeader: string): boolean {
  const secret = process.env.PAYDORA_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader || "";
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function isPaidDepositStatus(status: string) {
  return ["paid", "partial_paid", "paid_with_remarks", "repair_order_success", "in_game_paid"].includes(status);
}
