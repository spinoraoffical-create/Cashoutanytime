"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const ChatWidget = dynamic(
  () => import("./chat-widget").then((m) => m.ChatWidget),
  { ssr: false }
);

export function ChatWidgetLoader() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const start = () => setReady(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 6000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(start, 2000);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!ready) return null;
  return <ChatWidget />;
}
