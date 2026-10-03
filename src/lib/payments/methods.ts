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

/** Override via NEXT_PUBLIC_DEPOSIT_* env vars on Vercel if needed. */
export const DEPOSIT_PAYMENT_METHODS: DepositPaymentMethod[] = [
  {
    id: "paypal",
    label: "PayPal",
    username: process.env.NEXT_PUBLIC_DEPOSIT_PAYPAL || "@AnthonyCastro909",
    copyLabel: "PayPal @username",
    qrImage: depositQr("/payments/paypal-qr.png"),
    accent: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
  },
  {
    id: "chime",
    label: "Chime",
    username: process.env.NEXT_PUBLIC_DEPOSIT_CHIME || "$Anthony-Castro-208",
    copyLabel: "Chime $tag",
    payLink:
      process.env.NEXT_PUBLIC_DEPOSIT_CHIME_LINK ||
      "https://app.chime.com/link/qr?u=Anthony-Castro-208",
    qrImage: depositQr("/payments/chime-qr.png"),
    accent: "from-emerald-500/20 to-teal-600/10 border-emerald-500/30",
  },
  {
    id: "cashapp",
    label: "Cash App",
    username: process.env.NEXT_PUBLIC_DEPOSIT_CASHAPP || "$AnthonyCastro80",
    copyLabel: "Cash App $tag",
    payLink:
      process.env.NEXT_PUBLIC_DEPOSIT_CASHAPP_LINK ||
      "https://cash.app/$AnthonyCastro80",
    qrImage: depositQr("/payments/cashapp-qr.png"),
    accent: "from-green-500/20 to-lime-600/10 border-green-500/30",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    username:
      process.env.NEXT_PUBLIC_DEPOSIT_BITCOIN ||
      "1L2GidwNBzXKcnrpdHYaVGpZSrhvQcSbKV",
    copyLabel: "BTC address",
    qrImage: depositQr("/payments/bitcoin-qr.png"),
    accent: "from-orange-500/20 to-amber-600/10 border-orange-500/30",
  },
  {
    id: "usdt",
    label: "USDT",
    username:
      process.env.NEXT_PUBLIC_DEPOSIT_USDT ||
      "0x3d3528b297f150e0749f10bd91dae18e4defca45",
    copyLabel: "USDT address (ERC-20)",
    qrImage: depositQr("/payments/usdt-qr.png"),
    accent: "from-teal-500/20 to-cyan-600/10 border-teal-500/30",
  },
  {
    id: "venmo",
    label: "Venmo",
    username: process.env.NEXT_PUBLIC_DEPOSIT_VENMO || "@Anthony-Castro-414",
    copyLabel: "Venmo @username",
    payLink:
      process.env.NEXT_PUBLIC_DEPOSIT_VENMO_LINK ||
      "https://venmo.com/code?user_id=4583530403202663035&created=1781244725",
    qrImage: depositQr("/payments/venmo-qr.png"),
    accent: "from-sky-500/20 to-indigo-600/10 border-sky-500/30",
  },
];

export function getDepositMethod(id: DepositPaymentMethodId): DepositPaymentMethod | undefined {
  return DEPOSIT_PAYMENT_METHODS.find((m) => m.id === id);
}
