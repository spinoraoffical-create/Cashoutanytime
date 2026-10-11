"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createPlayerTicket, type PlayerTicketRow } from "@/lib/actions/player-tickets";
import type { TicketStatus } from "@/lib/database.types";

const STATUSES: TicketStatus[] = ["open", "pending", "in_progress", "resolved", "closed"];

export function PlayerTicketDesk({
  total,
  pending,
  resolved,
  openSlotsLeft,
  tickets,
}: {
  total: number;
  pending: number;
  resolved: number;
  openSlotsLeft: number;
  tickets: PlayerTicketRow[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pendingSave, startSave] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (status && ticket.status !== status) return false;
      if (!needle) return true;
      const haystack = [`#${ticket.ticketNo}`, ticket.subject, ...ticket.messages.map((message) => message.body)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, status, tickets]);

  function submit() {
    startSave(async () => {
      const result = await createPlayerTicket({ subject, body });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setSubject("");
      setBody("");
      toast.success(`Ticket #${result.ticketNo} was sent to support.`);
      router.refresh();
    });
  }

  return (
    <section id="create-ticket" className="space-y-4 rounded-2xl border border-white/10 p-4">
      <div>
        <h2 className="text-xl font-black">Create Ticket</h2>
        <p className="mt-1 text-sm text-[#b9b3c6]">
          A ticket goes to Super Admin. You can have {openSlotsLeft} more open ticket{openSlotsLeft === 1 ? "" : "s"}.
        </p>
      </div>
      <label className="block text-sm font-bold">
        Subject
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          maxLength={140}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-[#14101c] px-3 py-3 text-sm outline-none"
        />
      </label>
      <label className="block text-sm font-bold">
        Message
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={5000}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-[#14101c] px-3 py-3 text-sm outline-none"
        />
      </label>
      <button
        type="button"
        disabled={pendingSave || openSlotsLeft === 0}
        onClick={submit}
        className="h-12 rounded-2xl bg-white px-4 text-sm font-black text-[#14101c] disabled:opacity-40"
      >
        Submit Ticket
      </button>

      <div className="grid grid-cols-3 gap-2 text-center">
        <p className="rounded-2xl border border-white/10 px-2 py-3 text-sm">
          <span className="block text-lg font-black">{total}</span>Total
        </p>
        <p className="rounded-2xl border border-white/10 px-2 py-3 text-sm">
          <span className="block text-lg font-black">{pending}</span>Pending
        </p>
        <p className="rounded-2xl border border-white/10 px-2 py-3 text-sm">
          <span className="block text-lg font-black">{resolved}</span>Resolved
        </p>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search ticket number, subject, or message"
        className="w-full rounded-2xl border border-white/10 bg-[#14101c] px-3 py-3 text-sm outline-none"
      />
      <label className="block text-sm font-bold">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-[#14101c] px-3 py-3 text-sm outline-none"
        >
          <option value="">Choose a status</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      {visible.length === 0 ? (
        <p className="text-sm text-[#b9b3c6]">No tickets to show.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl border border-white/10 px-3 py-3">
              <p className="text-sm font-bold">
                #{ticket.ticketNo} · {ticket.subject}
              </p>
              <p className="text-xs uppercase text-[#b9b3c6]">{ticket.status.replace("_", " ")}</p>
              <ul className="mt-2 space-y-2">
                {ticket.messages.map((message, index) => (
                  <li key={`${ticket.id}-${index}`} className="text-sm">
                    <p className="text-xs font-bold text-[#b9b3c6]">{message.is_staff ? "Support" : "You"}</p>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
