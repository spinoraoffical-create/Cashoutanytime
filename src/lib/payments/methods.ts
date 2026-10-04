export type DepositPaymentMethodId =
  | "paypal"
  | "chime"
  | "cashapp"
  | "bitcoin"
  | "usdt"
  | "venmo";

export interface DepositPaymentMethod {
  id: DepositPaymentMethodId;
  label: string;
  /** Shown to users — copy to send payment */
  username: string;
  copyLabel: string;
  /** Opens in browser / app when user taps Pay using link */
  payLink?: string;
  /** Public path under /public */
  qrImage: string;
  accent: string;
}

/** Bump when replacing files in /public/payments/ so browsers fetch fresh QR images. */
const DEPOSIT_QR_VERSION = "20260614b";

function depositQr(path: string) {
  return `${path}?v=${DEPOSIT_QR_VERSION}`;
}

function envText(name: string): string {
  return process.env[name]?.trim() || "";
}

/** Handles come only from NEXT_PUBLIC_DEPOSIT_* env vars — never hardcoded. */
export const DEPOSIT_PAYMENT_METHODS: DepositPaymentMethod[] = [
  {
    id: "paypal",
    label: "PayPal",
    username: envText("NEXT_PUBLIC_DEPOSIT_PAYPAL"),
    copyLabel: "PayPal @username",
    qrImage: depositQr("/payments/paypal-qr.png"),
    accent: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  },
  {
    id: "chime",
    label: "Chime",
    username: envText("NEXT_PUBLIC_DEPOSIT_CHIME"),
    copyLabel: "Chime $tag",
    payLink: envText("NEXT_PUBLIC_DEPOSIT_CHIME_LINK") || undefined,
    qrImage: depositQr("/payments/chime-qr.png"),
    accent: "from-emerald-500/20 to-teal-600/10 border-emerald-500/30",
  },
  {
    id: "cashapp",
    label: "Cash App",
    username: envText("NEXT_PUBLIC_DEPOSIT_CASHAPP"),
    copyLabel: "Cash App $tag",
    payLink: envText("NEXT_PUBLIC_DEPOSIT_CASHAPP_LINK") || undefined,
    qrImage: depositQr("/payments/cashapp-qr.png"),
    accent: "from-green-500/20 to-lime-600/10 border-green-500/30",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    username: envText("NEXT_PUBLIC_DEPOSIT_BITCOIN"),
    copyLabel: "BTC address",
    qrImage: depositQr("/payments/bitcoin-qr.png"),
    accent: "from-orange-500/20 to-amber-600/10 border-orange-500/30",
  },
  {
    id: "usdt",
    label: "USDT",
    username: envText("NEXT_PUBLIC_DEPOSIT_USDT"),
    copyLabel: "USDT address (ERC-20)",
    qrImage: depositQr("/payments/usdt-qr.png"),
    accent: "from-teal-500/20 to-cyan-600/10 border-teal-500/30",
  },
  {
    id: "venmo",
    label: "Venmo",
    username: envText("NEXT_PUBLIC_DEPOSIT_VENMO"),
    copyLabel: "Venmo @username",
    payLink: envText("NEXT_PUBLIC_DEPOSIT_VENMO_LINK") || undefined,
    qrImage: depositQr("/payments/venmo-qr.png"),
    accent: "from-sky-500/20 to-indigo-600/10 border-sky-500/30",
  },
];

export function getDepositMethod(id: DepositPaymentMethodId): DepositPaymentMethod | undefined {
  return DEPOSIT_PAYMENT_METHODS.find((m) => m.id === id);
}
