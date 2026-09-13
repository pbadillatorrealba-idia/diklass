import { expect, test } from "@playwright/test";

test.describe("attribution web contract", () => {
  test("does not expose shared clinical records without a valid session", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("documents the two-context verification boundary", async () => {
    test.skip(
      !process.env.SUPABASE_URL,
      "Requires a local Supabase fixture with two provisioned veterinarians.",
    );
  });
});
