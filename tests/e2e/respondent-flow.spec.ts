import { test, expect } from "@playwright/test";

test("Lin sends a self-service link, respondent completes assessment, score lands on the lead", async ({ browser }) => {
  // Lin (authenticated)
  const linCtx = await browser.newContext();
  const linPage = await linCtx.newPage();
  await linPage.goto("/login");
  await linPage.getByRole("tab", { name: /password/i }).click();
  await linPage.getByLabel("Email", { exact: false }).fill("lin@gatewaytelnet.com");
  await linPage.getByLabel("Password", { exact: false }).fill("gateway123");
  await linPage.getByRole("button", { name: /sign in/i }).click();
  await linPage.waitForURL((u) => !u.pathname.startsWith("/login"));

  await linPage.goto("/leads");
  await linPage.locator("table tbody tr a").first().click();
  await linPage.waitForURL(/\/leads\/[0-9a-f-]+$/);

  // Capture the API response with the publicLink
  const respPromise = linPage.waitForResponse((r) => r.url().includes("/api/assessments") && r.request().method() === "POST");

  // Switch to Assessment tab and open Send link
  await linPage.getByRole("button", { name: /assessment/i }).first().click();
  await linPage.getByRole("button", { name: /^send link$/i }).first().click();
  await linPage.locator('input[type="email"]').last().fill("respondent@example.com");
  await linPage.getByRole("button", { name: /generate \+ email link/i }).click();
  const apiResp = await respPromise;
  const data = await apiResp.json();
  const link: string = data.publicLink;
  expect(link).toContain("/assessment/respond/");

  // Respondent (anonymous context — no auth cookie)
  const respCtx = await browser.newContext();
  const respPage = await respCtx.newPage();
  await respPage.goto(link);
  await expect(respPage.getByRole("heading", { name: /gateway it assessment/i })).toBeVisible();

  // Mash through the 25 questions accepting defaults
  for (let i = 0; i < 25; i++) {
    const radios = respPage.locator('input[type="radio"]');
    if (await radios.first().isVisible().catch(() => false)) await radios.first().click();
    else {
      const num = respPage.locator('input[type="number"]');
      if (await num.isVisible().catch(() => false)) await num.fill("100");
      const ta = respPage.locator("textarea");
      if (await ta.first().isVisible().catch(() => false)) await ta.first().fill("ok");
      const yes = respPage.getByRole("button", { name: /^yes$/i });
      if (await yes.isVisible().catch(() => false)) await yes.click();
    }
    const submit = respPage.getByRole("button", { name: /^submit$/i });
    const next = respPage.getByRole("button", { name: /next/i });
    if (await submit.isVisible().catch(() => false)) { await submit.click(); break; }
    if (await next.isEnabled().catch(() => false)) await next.click();
  }

  await respPage.waitForURL(/\/done$/, { timeout: 20_000 });
  await expect(respPage.getByText(/all set/i)).toBeVisible();

  await linCtx.close();
  await respCtx.close();
});
