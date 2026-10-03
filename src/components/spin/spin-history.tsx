import { formatDate, formatRelativeTime } from "@/lib/utils";

interface SpinRecord {
  id: string;
  prize_label: string;
  prize_type: string;
  prize_value: number;
  created_at: string;
}

export function SpinHistory({ history }: { history: SpinRecord[] }) {
  if (history.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No spin history yet. Spin the wheel to get started!
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4">Date & Time</th>
            <th className="pb-3 pr-4">Prize</th>
            <th className="pb-3 pr-4">Type</th>
            <th className="pb-3">When</th>
          </tr>
        </thead>
        <tbody>
          {history.map((spin) => (
            <tr key={spin.id} className="border-b border-border/50">
              <td className="py-3 pr-4">{formatDate(spin.created_at)}</td>
              <td className="py-3 pr-4 font-semibold text-amber-400">{spin.prize_label}</td>
              <td className="py-3 pr-4 capitalize text-muted-foreground">{spin.prize_type}</td>
              <td className="py-3 text-muted-foreground">{formatRelativeTime(spin.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
