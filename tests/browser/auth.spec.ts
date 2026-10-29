import { test, expect } from "@playwright/test";
test("redesigned passenger authentication responds to desktop and recovery navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/auth");
  await expect(
    page.getByText("Welcome aboard.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("More than a crossing.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/auth-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Forgot password", exact: true })
    .click();
  await expect(
    page.getByText("Forgot your password?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await expect(
    page.getByText("Welcome aboard.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Terms and privacy", exact: true })
    .click();
  await expect(
    page.getByText("Booking and safety", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
