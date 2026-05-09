import { test, expect } from "./fixtures";

test.describe("Phase 5 — project list", () => {
  test("redirects to /login when unauthenticated", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(page.url()).toContain("/login");
    expect(res?.status()).toBeLessThan(400);
  });

  test("empty state shows when user has no projects", async ({ signedInPage: page }) => {
    await page.goto("/");
    await expect(page.getByTestId("empty-projects")).toBeVisible();
    await expect(page.getByRole("heading", { name: /no projects yet/i })).toBeVisible();
  });

  test("create project via dialog renders the new card", async ({ signedInPage: page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });
    const name = `Test Project ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("empty-projects").waitFor();
    await page.getByTestId("new-project-btn").click();
    const dialog = page.getByTestId("new-project-dialog");
    await dialog.waitFor();
    await dialog.getByLabel("Name").fill(name);

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/v2/projects") && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: "Create", exact: true }).click(),
    ]);
    expect(response.status(), `errors: ${errors.join(" | ")}`).toBe(201);

    await expect(
      page.getByTestId("project-card").filter({ hasText: name }),
    ).toBeVisible();
  });

  test("sort tabs and search are present", async ({ signedInPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("tab", { name: /recently active/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /A.Z/i })).toBeVisible();
    await expect(page.getByPlaceholder("Search projects…")).toBeVisible();
  });
});
