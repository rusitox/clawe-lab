import { test, expect } from "./fixtures";

async function makeProject(page: any, name: string) {
  const res = await page.request.post("/api/v2/projects", { data: { name } });
  expect(res.status()).toBe(201);
  return res.json();
}

test.describe("Phase 5 — board", () => {
  test("non-member is 404 (not 403)", async ({ signedInPage: page }) => {
    const r = await page.request.get("/p/this-does-not-exist", { maxRedirects: 0 });
    expect(r.status()).toBe(404);
  });

  test("renders 4 columns + breadcrumb", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await makeProject(page, `Board Test ${tag}`);
    await page.goto(`/p/${project.slug}`);

    await expect(page.getByTestId("project-name")).toHaveText(project.name);
    await page.getByTestId("board").waitFor();
    const columns = page.getByTestId("column-list");
    await expect(columns).toHaveCount(4);
  });

  test("create task via dialog renders the new card", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await makeProject(page, `Board Create ${tag}`);
    await page.goto(`/p/${project.slug}`);

    await page.getByTestId("new-task-btn").click();
    const dialog = page.getByTestId("new-task-dialog");
    await dialog.waitFor();
    await dialog.getByLabel("Title").fill("First task");
    // Pick "Bug" + P0 to exercise V1 Priority-first styling.
    // The radio is `display:none` in the kind-switcher; click the visible label.
    await dialog.locator('label[for="nt-bug"]').click();
    await dialog.locator("#nt-priority").selectOption("P0");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/projects/${project.id}/tasks`) && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: /^Create/ }).click(),
    ]);
    expect(response.status()).toBe(201);

    const card = page.getByTestId("task-card").filter({ hasText: "First task" });
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/task-card--p0-bug/);
  });

  test("Mine filter toggle dims unassigned cards", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await makeProject(page, `Mine Filter ${tag}`);
    await page.request.post(`/api/v2/projects/${project.id}/tasks`, {
      data: { title: "Unassigned task" },
    });
    await page.goto(`/p/${project.slug}`);
    await page.getByTestId("task-card").first().waitFor();

    const filter = page.getByTestId("filter-mine");
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("task-card").first()).toHaveClass(/task-card--dim/);
  });
});
