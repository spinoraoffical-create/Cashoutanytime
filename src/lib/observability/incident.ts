/** Short id for an admin log line. Do not pass secrets or document bytes. */

export function incidentCode(): string {
  return `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logIncident(area: string, message: string): string {
  const id = incidentCode();
  const safe = message.replace(/\s+/g, " ").slice(0, 180);
  console.error(`[${area}] ${id} ${safe}`);
  return id;
}
