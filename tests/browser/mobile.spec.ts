import { test, expect } from "@playwright/test";
test("passenger onboarding, explore and configuration boundary", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Find your next shore.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip introduction" }).click();
  await expect(
    page.getByText("Where are we heading?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Getting ready to sail", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search boats" }).click();
  await expect(
    page.getByText(
      "No eligible schedules found. Try another date or destination.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.querySelectorAll("*").forEach((element) => {
      if (
        element instanceof HTMLElement &&
        element.scrollHeight > element.clientHeight
      )
        element.scrollTop = 0;
    });
  });
  await page.screenshot({
    path: "test-results/passenger-explore.png",
    fullPage: true,
  });
  await page.getByText("My trips", { exact: true }).click();
  await expect(
    page.getByText("Sign in to view your bookings and payment status."),
  ).toBeVisible();
  await page.goto("/auth");
  await expect(
    page.getByText("Welcome aboard.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("local-preview-test");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveJSProperty(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText(
      "BangkaGo is awaiting its Supabase connection. See the setup guide.",
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    document.querySelectorAll("*").forEach((e) => {
      if (e instanceof HTMLElement && e.scrollHeight > e.clientHeight)
        e.scrollTop = 0;
    }),
  );
  await page.screenshot({
    path: "test-results/auth-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Boat owner", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Boat owner", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
