import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const env = parseEnv(await readFile(new URL(".env.owner", root), "utf8"));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.EDGE_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
try {
  await page.goto("http://localhost:3215");
  await page.getByLabel("Senha", { exact: true }).fill(env.OWNER_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.locator(".page").waitFor();
  for (const route of [
    "",
    "biblioteca",
    "praticar",
    "revisar",
    "jornada",
    "configuracoes",
    "onboarding",
  ]) {
    await page.goto(`http://localhost:3215/${route}`);
    await page.locator(".page").waitFor();
    if (route === "revisar") {
      await page
        .getByText("Abrindo o baralho…", { exact: true })
        .waitFor({ state: "hidden" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: fileURLToPath(
          new URL(".impeccable/review/revisar-mobile.png", root),
        ),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      route: route || "hoje",
      violations: result.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        nodes: nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  await page.goto("http://localhost:3215");
  await page
    .getByRole("button", { name: "Continuar minha sessão", exact: true })
    .click();
  await page.locator(".study").waitFor();
  const study = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({ route: "estudo", violations: study.violations });
  await page.goto("http://localhost:3215/configuracoes");
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  results.push({
    route: "configuracoes-dark-mobile",
    violations: dark.violations,
  });
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await writeFile(
    new URL(".impeccable/review/accessibility-results.json", root),
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({ route: r.route, violations: r.violations })),
      null,
      2,
    ),
  );
  if (results.some((r) => r.violations.length)) process.exitCode = 1;
} finally {
  await browser.close();
}
