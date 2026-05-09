import { test, expect } from "./fixtures";

async function newProject(page: any, name: string) {
  const res = await page.request.post("/api/v2/projects", { data: { name } });
  expect(res.status()).toBe(201);
  return res.json();
}

async function newTask(page: any, projectId: string, body: any) {
  const res = await page.request.post(`/api/v2/projects/${projectId}/tasks`, {
    data: body,
  });
  expect(res.status()).toBe(201);
  return res.json();
}

test.describe("Phase 5 finale — drawer / DnD / activity / members / tokens", () => {
  test("clicking a task card opens the detail drawer", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await newProject(page, `Drawer Test ${tag}`);
    await newTask(page, project.id, { title: "Inspect me", kind: "task" });
    await page.goto(`/p/${project.slug}`);
    await page.getByTestId("task-card").first().click();
    await expect(page.getByTestId("task-drawer")).toBeVisible();
    await expect(page.getByTestId("drawer-title")).toHaveText("Inspect me");
  });

  test("'Move to ...' button shifts the task to the next column", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await newProject(page, `Drawer Move ${tag}`);
    const t = await newTask(page, project.id, { title: "Push me", column: "backlog" });
    await page.goto(`/p/${project.slug}`);
    await page.getByTestId("task-card").click();
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/tasks/${t.id}/move`) && r.request().method() === "POST",
      ),
      page.getByTestId("move-next").click(),
    ]);
    expect(response.status()).toBe(200);
    const moved = await response.json();
    expect(moved.column).toBe("todo");
    // Drawer should be closed after move.
    await expect(page.getByTestId("task-drawer")).toBeHidden();
  });

  test("posting a comment renders it in the drawer", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await newProject(page, `Comments ${tag}`);
    await newTask(page, project.id, { title: "Discuss" });
    await page.goto(`/p/${project.slug}`);
    await page.getByTestId("task-card").click();
    await page.locator("#comment-body").fill("First comment");
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => /\/comments$/.test(r.url()) && r.request().method() === "POST",
      ),
      page.getByTestId("comment-send").click(),
    ]);
    expect(response.status()).toBe(201);
    await expect(page.getByTestId("comment-item").filter({ hasText: "First comment" })).toBeVisible();
  });

  test("activity drawer toggles open and lists events", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await newProject(page, `Activity ${tag}`);
    await newTask(page, project.id, { title: "Activity 1" });
    await page.goto(`/p/${project.slug}`);
    await page.getByTestId("activity-toggle").click();
    await expect(page.getByTestId("activity-drawer")).toBeVisible();
    await expect(page.getByTestId("activity-item").first()).toBeVisible();
  });

  test("members page renders and 'Invite' opens the dialog", async ({ signedInPage: page }) => {
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const project = await newProject(page, `Members ${tag}`);
    await page.goto(`/p/${project.slug}/members`);
    await expect(page.getByTestId("member-summary")).toContainText("1 members");
    await page.getByTestId("invite-btn").click();
    await expect(page.getByTestId("invite-dialog")).toBeVisible();
  });

  test("API tokens page reveals plaintext once on create", async ({ signedInPage: page }) => {
    await page.goto("/settings/tokens");
    await page.getByTestId("new-token-btn").click();
    await page.locator("#nt-name").fill(`e2e-${Date.now()}`);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/v2/tokens") && r.request().method() === "POST"),
      page.getByText("Create", { exact: true }).click(),
    ]);
    expect(response.status()).toBe(201);
    const reveal = page.getByTestId("token-reveal-dialog");
    await expect(reveal).toBeVisible();
    await expect(page.getByTestId("token-plain")).toContainText("kbn_");
    await expect(page.getByTestId("token-row").first()).toBeVisible();
  });
});
