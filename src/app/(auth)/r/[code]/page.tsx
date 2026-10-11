import { redirect } from "next/navigation";

export default async function AgentReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const stored = decodeURIComponent(code).trim().slice(0, 32);
  const agentCode = /^[A-Za-z0-9_-]+$/.test(stored) ? stored : "";
  if (!agentCode) redirect("/register");
  redirect(`/register?agent=${encodeURIComponent(agentCode)}`);
}
