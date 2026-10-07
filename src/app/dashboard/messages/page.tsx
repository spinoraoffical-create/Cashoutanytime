"use client";

import { UserMessagesInbox } from "@/components/chat/user-messages-inbox";

export default function MessagesPage() {
  return (
    <div className="space-y-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#140a22] via-[#24152e] to-[#1a2744] p-5">
        <h1 className="max-w-sm text-3xl font-black leading-tight">The updates that matter, in one place.</h1>
        <p className="mt-2 max-w-sm text-sm text-[#b9b3c6]">
          Money status, support replies, security events, and account notices stay separate and easy to review.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("hub-mark-all-read"))}
          className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-bold"
        >
          Mark all read
        </button>
      </section>
      <UserMessagesInbox />
    </div>
  );
}
