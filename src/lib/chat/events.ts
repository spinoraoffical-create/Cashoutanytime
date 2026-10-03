import type { Message } from "@/types/database";

export const CHAT_INCOMING_EVENT = "spinora:chat-incoming";

export interface ChatIncomingDetail {
  conversationId: string;
  message?: Message;
}

export const GAME_REQUEST_EVENT = "spinora:game-request-update";

export interface GameRequestEventDetail {
  kind: "new" | "updated" | "completed" | "rejected";
  requestId: string;
}

export function dispatchChatIncoming(conversationId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatIncomingDetail>(CHAT_INCOMING_EVENT, {
      detail: { conversationId },
    })
  );
}

export function dispatchGameRequestUpdate(detail: GameRequestEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GameRequestEventDetail>(GAME_REQUEST_EVENT, { detail }));
}

export const TASK_SUBMISSION_EVENT = "spinora:task-submission-update";

export interface TaskSubmissionEventDetail {
  kind: "submitted" | "resubmitted" | "approved" | "rejected";
  submissionId: string;
}

export function dispatchTaskSubmissionUpdate(detail: TaskSubmissionEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TaskSubmissionEventDetail>(TASK_SUBMISSION_EVENT, { detail }));
}

export const DEPOSIT_REQUEST_EVENT = "spinora:deposit-request";

export interface DepositRequestEventDetail {
  kind: "new";
  depositId: string;
}

export function dispatchDepositRequestUpdate(detail: DepositRequestEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DepositRequestEventDetail>(DEPOSIT_REQUEST_EVENT, { detail }));
}
