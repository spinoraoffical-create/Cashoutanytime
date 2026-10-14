export const NEWSLETTER_STATUSES = ["draft", "scheduled", "sending", "sent", "failed"] as const;
export const PROMOTION_STATUSES = ["draft", "scheduled", "active", "expired", "archived"] as const;
export const BLOG_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export const AUTOMATION_JOB_HEALTH = ["off", "not_scheduled", "unknown", "stale", "ok"] as const;

export function newsletterStatusHelp(status: string) {
  switch (status) {
    case "draft":
      return "Saved. It has not been sent to players.";
    case "scheduled":
      return "Queued for a later time. It has not finished sending.";
    case "sending":
      return "A send is in progress. This is not the same as finished.";
    case "sent":
      return "The send is marked finished.";
    case "failed":
      return "The campaign is marked failed. That stored mark is not a new send.";
    default:
      return "Stored campaign status.";
  }
}

export function promotionStatusHelp(status: string) {
  switch (status) {
    case "draft":
      return "Saved. Players do not see a draft.";
    case "scheduled":
      return "Waiting for its start time.";
    case "active":
      return "Turned on for the current window.";
    case "expired":
      return "The end time has passed.";
    case "archived":
      return "Kept on file and turned off.";
    default:
      return "Stored promotion status.";
  }
}

export function blogStatusHelp(status: string) {
  switch (status) {
    case "draft":
      return "Saved. It is not published.";
    case "scheduled":
      return "Waiting for its publish time.";
    case "published":
      return "Marked published.";
    case "archived":
      return "Kept on file and turned off.";
    default:
      return "Stored post status.";
  }
}

export function automationJobHelp(health: string) {
  switch (health) {
    case "off":
      return "The saved switch is off.";
    case "not_scheduled":
      return "This job is not on the Vercel schedule. A switch that says on does not mean it is running.";
    case "unknown":
      return "A last run is not stored, so this screen cannot say whether it ran.";
    case "stale":
      return "The last saved run is later than expected.";
    case "ok":
      return "The last saved run is inside the expected window.";
    default:
      return "Saved job status.";
  }
}
