import { expect, test } from "@playwright/test";

test("Agent Ledger Console shows MCP tools and safe failures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agent Ledger Console" })).toBeVisible();
  await expect(page.getByRole("button", { name: /run safe read/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /try unsafe call/i })).toBeVisible();

  await page.getByText("Tool catalog and read-only annotations").click();
  await expect(page.locator(".tool-card").filter({ hasText: "list_tasks" })).toBeVisible();

  await page.getByRole("button", { name: /run selected tool/i }).click();
  await expect(page.getByRole("cell", { name: "Review MCP tool validation" })).toBeVisible();

  await page.getByRole("button", { name: /load search_notes/i }).click();
  await page.getByLabel("Query").fill("validation");
  await page.getByLabel("Limit").fill("3");
  await page.getByRole("button", { name: /run selected tool/i }).click();
  await expect(page.locator("#transcript").getByText("MCP validation notes").first()).toBeVisible();

  await page.getByRole("button", { name: /try unsafe call/i }).click();
  await expect(page.getByText(/Validation failed|table must/i)).toBeVisible();
});
