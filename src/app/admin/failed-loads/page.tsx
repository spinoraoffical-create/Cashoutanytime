import { redirect } from "next/navigation";

export default function FailedLoadsPage() {
  redirect("/admin/game-loads?status=failed");
}
