import { test, expect } from "@playwright/test";

test("run query and open it from history", async ({ page }) => {
  await page.goto("http://localhost:8080/?folder=/home/coder/project");

  await page.getByRole("tab", { name: "CodeQL" }).locator("a").click();

  // decline extension telemetry
  await page.getByRole("button", { name: "No", exact: true }).click({
    timeout: 60000,
  });

  await page.keyboard.press("Control+Shift+P");
  await page.keyboard.type("Create Query");
  await page.keyboard.press("Enter");

  await page.getByLabel("JavaScript, javascript").locator("a").click({
    timeout: 60000,
  });

  // select folder for first query
  await page
    .getByText(
      "Results0 SelectedPress 'Enter' to confirm your input or 'Escape' to cancelOK",
    )
    .press("Enter");

  // Download database
  await page
    .getByRole("button", { name: "Download database" })
    .click({ timeout: 60000 });
  await page.getByPlaceholder("https://github.com/<owner>/<").press("Enter");
  await page
    .locator("#list_id_3_0")
    .getByText("javascript")
    .click({ timeout: 60000 });

  await page.keyboard.press("Control+Shift+P");
  await page.keyboard.type("Run Query on selected");
  await page.keyboard.press("Enter");

  // select folder for first query run
  // await page.getByRole("button", { name: "OK" }).click();

  // check that query was run successfully and results page opens
  await page.getByText("Hello world on d3/d3").click({ timeout: 800000 });

  // close results page and open query from history
  await page
    .getByLabel("CodeQL Query Results, Editor Group")
    .getByLabel("Close (Ctrl+F4)")
    .click();
  await expect(
    page
      .frameLocator(".webview")
      .frameLocator('iframe[title="CodeQL Query Results"]')
      .getByText("#selectalerts32 resultsShow"),
  ).not.toBeVisible();

  await page
    .locator("#list_id_6_0")
    .getByLabel("Hello world on d3/d3 -")
    .locator("div")
    .first()
    .click();

  await expect(
    page
      .frameLocator('iframe[name="\\34 884429a-d667-4121-932e-99abaa20b599"]')
      .frameLocator('iframe[title="CodeQL Query Results"]')
      .getByText("#selectalerts32 resultsShow"),
  ).not.toBeVisible();
});
