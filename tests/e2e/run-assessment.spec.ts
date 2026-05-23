import { test, expect } from "@playwright/test";

test("Lin runs an in-person assessment and sees a deal-quality score", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: /password/i }).click();
  await page.getByLabel("Email", { exact: false }).fill("lin@gatewaytelnet.com");
  await page.getByLabel("Password", { exact: false }).fill("gateway123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/leads");
  // pick the first seeded lead
  await page.locator("table tbody tr a").first().click();
  await page.waitForURL(/\/leads\/[0-9a-f-]+$/);

  await page.getByRole("link", { name: /run assessment/i }).first().click();

  // We should be on /assessment/<id>
  await page.waitForURL(/\/assessment\//);

  // Click "Next" 24 times after answering required fields with defaults
  for (let i = 0; i < 25; i++) {
    // Try to satisfy each question minimally
    const radios = page.locator('input[type="radio"]');
    if (await radios.first().isVisible().catch(() => false)) {
      await radios.first().click();
    } else {
      const numeric = page.locator('input[type="number"]');
      if (await numeric.isVisible().catch(() => false)) await numeric.fill("100");
      const textarea = page.locator("textarea");
      if (await textarea.first().isVisible().catch(() => false)) await textarea.first().fill("test");
      const yesBtn = page.getByRole("button", { name: /^yes$/i });
      if (await yesBtn.isVisible().catch(() => false)) await yesBtn.click();
    }
    const submit = page.getByRole("button", { name: /^submit$/i });
    const next = page.getByRole("button", { name: /next/i });
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
      break;
    }
    if (await next.isEnabled().catch(() => false)) await next.click();
  }

  await page.waitForURL(/\/result$/, { timeout: 20_000 });
  await expect(page.getByText(/deal quality/i).first()).toBeVisible();
});
