self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim().slice(0, 80) : "Sweepstakes Hub";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 140) : "You have a new notice.";
  const url = safePath(payload.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(self.clients.openWindow(url));
});

self.addEventListener("notificationclose", () => {
  // Closing the alert is not proof it was read inside the site.
});

function safePath(value) {
  if (typeof value !== "string") return "/dashboard/inbox";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return "/dashboard/inbox";
  }
  return value;
}
