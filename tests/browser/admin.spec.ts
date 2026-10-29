import { test, expect } from "@playwright/test";
test("unconfigured workspace is honest and navigation works", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every journey, in view." }),
  ).toBeVisible();
  await expect(
    page.getByText("Your operations workspace is ready to connect"),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/overview-${info.project.name}.png`,
    fullPage: true,
  });
  await expect(
    page.getByText("Awaiting configuration", { exact: true }),
  ).toBeAttached();
  await page
    .getByRole("button", { name: "Open notifications", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Connect your workspace to receive live updates."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close notifications" }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Boat registrations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Boat registrations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No boat registrations yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Search Boat registrations" })
    .fill("no fabricated records");
  await expect(page.getByText("No matching records")).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Commission rules" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save new rule" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/admin-${info.project.name}.png`,
    fullPage: true,
  });
});
