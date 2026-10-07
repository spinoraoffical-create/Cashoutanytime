import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: false },
      { source: "/wallet", destination: "/dashboard/wallet", permanent: false },
      { source: "/activity", destination: "/dashboard/activity", permanent: false },
      { source: "/me", destination: "/dashboard", permanent: false },
      { source: "/account", destination: "/dashboard", permanent: false },
      { source: "/welcome-bonus", destination: "/dashboard/welcome", permanent: false },
      { source: "/account/verification", destination: "/dashboard/verification", permanent: false },
      { source: "/account/security", destination: "/dashboard/security", permanent: false },
      { source: "/account/notifications", destination: "/dashboard/notifications", permanent: false },
      { source: "/responsible", destination: "/dashboard/responsible", permanent: false },
      { source: "/missions", destination: "/dashboard/missions", permanent: false },
      { source: "/loyalty", destination: "/dashboard/vip", permanent: false },
      { source: "/inbox", destination: "/dashboard/messages", permanent: false },
      { source: "/affiliate", destination: "/dashboard/referrals", permanent: false },
      { source: "/rewards", destination: "/dashboard/rewards", permanent: false },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "sonner",
      "date-fns",
      "recharts",
      "@supabase/supabase-js",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
    ],
  },
};

export default nextConfig;
