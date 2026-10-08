export function toCsv(headers: string[], rows: string[][]) {
  const escape = (value: string) => {
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => row.map((cell) => escape(cell ?? "")).join(","))].join("\n");
}
