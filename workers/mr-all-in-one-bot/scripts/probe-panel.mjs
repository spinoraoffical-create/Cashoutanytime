import "dotenv/config";
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const url = process.env.MRALLINONE_ADMIN_URL ?? "https://agentserver.mrallinone777.com/admin/login";
const base = url.replace(/\/login.*$/i, "");
const cdpUrl = process.env.MRALLINONE_CDP_URL?.trim() || "http://127.0.0.1:9227";

console.log("Connecting to your Chrome via CDP:", cdpUrl);
const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
const pages = context.pages();
const page =
  pages.find((p) => p.url().includes("mrallinone777.com")) ?? pages[0] ?? (await context.newPage());
await page.bringToFront();

const dumpInputs = (els) =>
  els.map((el, i) => ({
    i,
    type: el.type,
    placeholder: el.placeholder,
    className: el.className?.slice?.(0, 80),
  }));

const clickable = async (root) =>
  [
    ...new Set(
      await (root ?? page)
        .locator("a, button, .el-menu-item, .el-button, span, li, .cell")
        .evaluateAll((els) =>
          els
            .map((el) => el.textContent?.trim().replace(/\s+/g, " "))
            .filter((t) => t && t.length > 1 && t.length < 40)
        )
    ),
  ];

try {
  console.log("\n=== CURRENT TAB ===");
  console.log(page.url(), "|", await page.title());

  // 1) Try to reach user management — click the sidebar item, then capture URL.
  console.log("\n=== NAVIGATING TO USER MANAGEMENT ===");
  const menu = page
    .locator("a, .el-menu-item, li, span")
    .filter({ hasText: /^\s*user management\s*$/i })
    .first();
  if ((await menu.count()) > 0 && (await menu.isVisible().catch(() => false))) {
    await menu.click().catch(() => {});
    await page.waitForTimeout(2500);
    console.log("After clicking 'User Management', URL =", page.url());
  } else {
    console.log("No 'User Management' menu item visible; current URL =", page.url());
  }

  await page.screenshot({ path: "probe-user-management.png", fullPage: true });
  writeFileSync("probe-user-management.html", (await page.content()).slice(0, 200000));

  // 2) Table headers
  const headers = (await page.locator(".el-table__header th, table th").allInnerTexts().catch(() => []))
    .map((h) => h.trim())
    .filter(Boolean);
  console.log("\n=== TABLE HEADERS ===\n" + headers.join(" | "));

  // 3) Search-area inputs (placeholders) + page-level inputs
  console.log("\n=== INPUTS ON PAGE ===");
  console.log(JSON.stringify(await page.locator("input").evaluateAll(dumpInputs), null, 2));

  // 4) Clickable texts (find Add user / Recharge / Redeem / Editor / Cashier)
  console.log("\n=== CLICKABLE TEXT (first 120) ===");
  console.log((await clickable()).slice(0, 120).join(" | "));

  // 5) Open the create dialog
  console.log("\n=== OPENING CREATE (Add user) DIALOG ===");
  const addBtn = page
    .locator("button, a, .el-button")
    .filter({ hasText: /add user|new account|add account|create/i })
    .first();
  if ((await addBtn.count()) > 0) {
    await addBtn.click().catch(() => {});
    await page.waitForTimeout(1800);
    const dlg = page.locator(".el-overlay:not([style*='display: none']) .el-dialog, .el-dialog").last();
    const title = await dlg.locator(".el-dialog__title").innerText().catch(() => "(no title)");
    console.log("DIALOG TITLE:", title);
    console.log("DIALOG INPUTS:", JSON.stringify(await dlg.locator("input").evaluateAll(dumpInputs), null, 2));
    const labels = await dlg.locator(".el-form-item__label, label").allInnerTexts().catch(() => []);
    console.log("DIALOG LABELS:", labels.map((l) => l.trim()).filter(Boolean).join(" | "));
    console.log("DIALOG BUTTONS:", (await clickable(dlg)).join(" | "));
    await page.screenshot({ path: "probe-add-user.png", fullPage: true });
    // close
    const cancel = dlg.locator("button").filter({ hasText: /cancel|close/i }).last();
    if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
    else await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(800);
  } else {
    console.log("Could not find an Add user / Create button.");
  }

  // 6) Inspect a data row's available action buttons (scroll table right first)
  console.log("\n=== FIRST ROW ACTION BUTTONS ===");
  const firstRow = page.locator(".el-table__body-wrapper tbody tr, table tbody tr").first();
  if ((await firstRow.count()) > 0) {
    await firstRow.scrollIntoViewIfNeeded().catch(() => {});
    const rowBtns = await firstRow
      .locator("button, a, .el-button, .cell")
      .evaluateAll((els) =>
        [...new Set(els.map((el) => el.textContent?.trim().replace(/\s+/g, " ")).filter((t) => t && t.length < 30))]
      )
      .catch(() => []);
    console.log("ROW TEXT/BUTTONS:", rowBtns.join(" | "));
  }
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  await page.screenshot({ path: "probe-error.png", fullPage: true }).catch(() => {});
} finally {
  browser.close().catch(() => {});
}
