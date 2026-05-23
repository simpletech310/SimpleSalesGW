import { test, expect } from "@playwright/test";

test("Lin can sign in with password and create a new lead", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: /password/i }).click();
  await page.getByLabel("Email", { exact: false }).fill("lin@gatewaytelnet.com");
  await page.getByLabel("Password", { exact: false }).fill("gateway123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await expect(page.getByRole("heading", { name: /pipeline/i })).toBeVisible();

  await page.goto("/leads/new");
  await page.getByLabel(/business name/i).fill("E2E Test Co.");
  await page.locator("select#industry").selectOption("PROFESSIONAL_SERVICES");
  await page.getByLabel(/seat count/i).fill("85");
  await page.getByLabel(/primary contact name/i).fill("Test Contact");
  await page.getByLabel(/primary contact email/i).fill("contact@example.com");
  await page.getByRole("button", { name: /create lead/i }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: /E2E Test Co\./ })).toBeVisible();
});
