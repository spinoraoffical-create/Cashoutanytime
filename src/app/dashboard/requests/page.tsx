import { redirect } from "next/navigation";

/** Game Requests removed — accounts are created automatically via game bots. */
export default function RequestsPage() {
  redirect("/dashboard");
}
