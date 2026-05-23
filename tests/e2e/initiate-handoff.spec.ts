import { test, expect } from "@playwright/test";

test("Lin can initiate a Sales-to-Ops handoff", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: /password/i }).click();
  await page.getByLabel("Email", { exact: false }).fill("lin@gatewaytelnet.com");
  await page.getByLabel("Password", { exact: false }).fill("gateway123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/leads");
  await page.locator("table tbody tr a").first().click();
  await page.waitForURL(/\/leads\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: /handoff to ops/i }).click();
  await page.waitForURL(/\/handoff$/);

  await page.getByRole("button", { name: /initiate handoff/i }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);
});
