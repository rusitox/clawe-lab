import { test, expect } from "./fixtures";

test.describe("Phase 5 smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-page")).toBeVisible();
    await expect(page.getByTestId("google-signin")).toBeVisible();
  });

  test("login error state renders the danger banner", async ({ page }) => {
    await page.goto("/login?error=oauth_failed");
    await expect(page.getByTestId("login-error")).toBeVisible();
  });

  test("login rejection state renders the warning banner", async ({ page }) => {
    await page.goto("/login?rejection=1");
    await expect(page.getByTestId("login-rejection")).toBeVisible();
  });

  test("test-login bypass returns a session cookie", async ({ signedInPage }) => {
    const meRes = await signedInPage.request.get("/api/v2/me");
    expect(meRes.status()).toBe(200);
    const me = await meRes.json();
    expect(me.email).toMatch(/@example\.com$/);
  });

  test("api/health is up", async ({ page }) => {
    const r = await page.request.get("/api/health");
    expect(r.status()).toBe(200);
    expect((await r.json()).db).toBe("up");
  });
});
