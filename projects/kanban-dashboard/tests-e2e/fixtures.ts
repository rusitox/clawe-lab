import { test as base, expect } from "@playwright/test";

type Fixtures = {
  signedInPage: import("@playwright/test").Page;
};

export const test = base.extend<Fixtures>({
  signedInPage: async ({ page }, use) => {
    const email = `e2e-${Date.now()}@example.com`;
    const response = await page.request.get(
      `/auth/test-login?email=${encodeURIComponent(email)}&name=E2E`,
      { maxRedirects: 0 }
    );
    if (response.status() !== 302) {
      throw new Error(
        `test-login bypass returned ${response.status()}. Make sure TEST_AUTH_BYPASS=true.`
      );
    }
    await use(page);
  },
});

export { expect };
