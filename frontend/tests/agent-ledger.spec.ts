import { expect, test } from "@playwright/test";

test("Agent Ledger Console shows MCP tools and safe failures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agent Ledger Console" })).toBeVisible();
  await expect(page.locator(".tool-card").filter({ hasText: "list_tasks" })).toBeVisible();

  await expect(page.locator("text=Safety presets").locator("..")).toContainText("5");

  await page.getByRole("button", { name: /run selected tool/i }).click();
  await expect(page.getByRole("cell", { name: "Review MCP tool validation" })).toBeVisible();

  await page.getByRole("button", { name: /load search_notes/i }).click();
  await page.getByLabel("Input JSON").fill(JSON.stringify({ query: "validation", limit: 3 }, null, 2));
  await page.getByRole("button", { name: /run selected tool/i }).click();
  await expect(page.locator("#transcript").getByText("MCP validation notes").first()).toBeVisible();

  await page.getByRole("button", { name: /unsafe table/i }).click();
  await expect(page.getByText(/Validation failed|table must/i)).toBeVisible();
});
