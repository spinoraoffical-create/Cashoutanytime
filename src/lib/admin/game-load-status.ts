export const GAME_LOAD_STATUSES = ["pending", "processing", "completed", "failed", "cancelled"] as const;

export function gameLoadStatusHelp(status: string) {
  switch (status) {
    case "pending":
      return "Waiting. The request is not finished.";
    case "processing":
      return "Work has started. The request is not finished. A slow response is not proof the provider transaction failed.";
    case "completed":
      return "The request is marked finished.";
    case "failed":
      return "The request is marked failed. That stored mark is not, by itself, proof of what the provider did.";
    case "cancelled":
      return "The request is marked cancelled.";
    default:
      return "Stored status on the game-load request.";
  }
}
