"use client";

/** Custom sidebar icons matching the reference casino UI */
export function IconLobby({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 2L3 7v11h5v-6h4v6h5V7L10 2z" />
    </svg>
  );
}

export function IconSlots777({ className }: { className?: string }) {
  return (
    <span className={`font-black text-[11px] leading-none tracking-tighter ${className ?? ""}`}>777</span>
  );
}

export function IconFish({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8 2 4 6 4 10c0 2 .8 3.8 2.2 5.2L2 22l6.8-4.2C10.2 18.6 11 18.8 12 18.8c4 0 8-3.6 8-8.8S16 2 12 2zm0 13c-.8 0-1.6-.2-2.3-.5l-.5-.2-3.2 2 1.1-3.5-.3-.5C6.2 11.4 6 10.7 6 10c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6z" />
      <circle cx="14" cy="9" r="1.2" fill="#fff" />
    </svg>
  );
}

export function IconTableCards({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="4" width="12" height="16" rx="2" opacity="0.7" />
      <rect x="9" y="2" width="12" height="16" rx="2" />
      <text x="13" y="13" fontSize="7" fill="white" fontWeight="bold">A</text>
    </svg>
  );
}

export function IconLiveCasino({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8px] font-black bg-red-600 text-white leading-none ${className ?? ""}`}
    >
      LIVE
    </span>
  );
}

export function IconFortuneWheel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden>
      <defs>
        <linearGradient id="wheel-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="url(#wheel-gold)" stroke="#fcd34d" strokeWidth="3" />
      <circle cx="40" cy="40" r="32" fill="#4c1d95" stroke="#a78bfa" strokeWidth="2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="40"
          y1="40"
          x2={40 + 30 * Math.cos((deg * Math.PI) / 180)}
          y2={40 + 30 * Math.sin((deg * Math.PI) / 180)}
          stroke="#fcd34d"
          strokeWidth="1.5"
        />
      ))}
      <circle cx="40" cy="40" r="8" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
      <polygon points="40,4 44,14 36,14" fill="#ef4444" />
    </svg>
  );
}

export function IconGoldCoin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
      <circle cx="16" cy="16" r="11" fill="#fcd34d" stroke="#d97706" strokeWidth="1" />
      <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="900" fill="#92400e">$</text>
    </svg>
  );
}

export function IconGiftBox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="gift-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>
      <rect x="6" y="20" width="36" height="24" rx="3" fill="url(#gift-red)" />
      <rect x="4" y="14" width="40" height="10" rx="2" fill="#dc2626" />
      <rect x="21" y="14" width="6" height="30" fill="#fcd34d" />
      <rect x="6" y="17" width="36" height="5" fill="#fcd34d" />
      <ellipse cx="16" cy="12" rx="8" ry="6" fill="#fbbf24" />
      <ellipse cx="32" cy="12" rx="8" ry="6" fill="#fbbf24" />
    </svg>
  );
}

export function IconCrownSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M2 12h12v2H2v-2zm1.5-8L5 7l3-4 3 4 1.5-3L14 12H2l1.5-8z" />
    </svg>
  );
}
