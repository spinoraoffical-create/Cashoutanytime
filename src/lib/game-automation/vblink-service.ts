import { changeVblinkScore, createVblinkPlayer, getVblinkBalance, isVblinkApiConfigured } from "./vblink-portal";

export { isVblinkApiConfigured };

export async function autoFulfillVblinkRequest(
  requestId: string,
  loadType: "create_account" | "new_account" | "check_balance" | "load" | "reload" | "redeem",
  input: {
    userId: string;
    gameUsername?: string | null;
    amount?: number | null;
    requestedUsername?: string | null;
    requestedPassword?: string | null;
  }
): Promise<{ success: boolean; error?: string; username?: string; password?: string; redeemedAmount?: number }> {
  if (!isVblinkApiConfigured()) {
    return { success: false, error: "VBlink agent login is not configured." };
  }

  try {
    if (loadType === "create_account" || loadType === "new_account") {
      const username = input.requestedUsername?.trim() || "";
      const password = input.requestedPassword?.trim() || "";
      if (!username) return { success: false, error: "Account not found" };
      const created = await createVblinkPlayer(username, password);
      return { success: true, username: created.account, password };
    }

    const username = input.gameUsername?.trim() || "";
    if (!username) return { success: false, error: "Account not found" };

    if (loadType === "check_balance") {
      const balance = await getVblinkBalance(username);
      return { success: true, redeemedAmount: balance };
    }

    const amount = Number(input.amount || 0);
    if (loadType === "load" || loadType === "reload") {
      await changeVblinkScore(username, amount, "in");
      return { success: true };
    }

    if (loadType === "redeem") {
      await changeVblinkScore(username, amount, "out");
      return { success: true, redeemedAmount: amount };
    }

    return { success: false, error: "Request failed. Please try again or contact support." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "VBlink is busy. Try again in a moment.";
    console.error("[vblink]", requestId, message);
    return { success: false, error: message };
  }
}
