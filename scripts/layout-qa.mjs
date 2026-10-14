// TASK-023: barra lateral alcançável em janela baixa e painel de ferramentas
// recolhível. Roda por scripts/qa-isolated.ts.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
if (!process.env.FQ_QA_PASSWORD)
  throw new Error("Execute por scripts/qa-isolated.ts");
const base = "http://localhost:3215";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.EDGE_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 650 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const width = (selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
const scan = async (label, theme, viewport) => {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".youtube-host iframe")
    .analyze();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  results.push({
    label,
    theme,
    viewport,
    violations: axe.violations,
    overflow,
  });
};
const setTheme = async (theme) => {
  await page.goto(`${base}/configuracoes`);
  await page
    .getByRole("button", {
      name: theme === "light" ? "Claro" : "Escuro",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    (value) => document.documentElement.dataset.theme === value,
    theme,
  );
};
try {
  await page.goto(base);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.FQ_QA_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.locator(".page").waitFor();
  const railToggle = page.getByRole("button", {
    name: "Recolher a barra lateral",
  });
  // CA-01: em janela baixa o botão continua à vista, sem rolar.
  for (const [w, h] of [
    [1366, 650],
    [1280, 560],
    [1920, 946],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/biblioteca`);
    await page.locator(".page").waitFor();
    await expect(railToggle).toBeInViewport({ ratio: 1 });
  }
  await page.setViewportSize({ width: 1366, height: 650 });
  await railToggle.click();
  await expect(railToggle).toHaveAttribute("aria-pressed", "true");
  if ((await width(".sidebar")) > 70)
    throw new Error("A barra não recolheu para o trilho");
  await expect(railToggle).toBeInViewport({ ratio: 1 });
  await railToggle.click();
  await expect(railToggle).toHaveAttribute("aria-pressed", "false");
  // CA-02: o painel recolhido dá a largura dele à transcrição e persiste.
  await page
    .locator(".source-row h2 a", { hasText: "Debugging a flaky test" })
    .click();
  await page.locator(".study").waitFor();
  const panelToggle = page.locator(".panel-toggle");
  await expect(panelToggle).toHaveAttribute("aria-expanded", "true");
  const readingOpen = await width(".study-reading");
  await panelToggle.click();
  await expect(panelToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#study-tools")).toBeHidden();
  const readingClosed = await width(".study-reading");
  if ((await width(".study-panel")) > 50)
    throw new Error("O painel não recolheu para o trilho");
  if (readingClosed - readingOpen < 200)
    throw new Error(
      `A transcrição ganhou só ${readingClosed - readingOpen}px (${readingOpen} → ${readingClosed})`,
    );
  await page.reload();
  await page.locator(".study").waitFor();
  await expect(panelToggle).toHaveAttribute("aria-expanded", "false");
  // CA-03: o rascunho em andamento sobrevive a recolher e reabrir.
  await panelToggle.click();
  // A sessão de QA pode reabrir a sala em outra aba do painel.
  await page.getByRole("tab", { name: "Expressão" }).click();
  await page.getByRole("button", { name: "Preparar cartão" }).click();
  const field = page
    .locator(".study-panel input, .study-panel textarea")
    .first();
  await field.fill("rascunho em andamento");
  await panelToggle.click();
  await panelToggle.click();
  await expect(field).toHaveValue("rascunho em andamento");
  await panelToggle.click();
  // CA-04: axe e overflow nos estados novos, claro e escuro.
  const studyUrl = page.url();
  for (const theme of ["light", "dark"]) {
    await setTheme(theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(studyUrl);
    await page.locator(".study").waitFor();
    await expect(panelToggle).toHaveAttribute("aria-expanded", "false");
    await scan("painel-recolhido", theme, "1440x1000");
    await page.screenshot({
      path: `.impeccable/review/panel-collapsed-${theme}-1440.png`,
    });
    await page
      .getByRole("button", { name: "Recolher a barra lateral" })
      .click();
    await scan("painel-e-barra-recolhidos", theme, "1440x1000");
    await page
      .getByRole("button", { name: "Recolher a barra lateral" })
      .click();
    // RN-04: empilhado, o controle some e nada fica escondido.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(studyUrl);
    await page.locator(".study").waitFor();
    await expect(panelToggle).toBeHidden();
    await expect(page.locator("#study-tools")).toBeVisible();
    await scan("painel-mobile", theme, "390x844");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(studyUrl);
  await page.locator(".study").waitFor();
  await panelToggle.click();
  await expect(panelToggle).toHaveAttribute("aria-expanded", "true");
  await setTheme("light");
  await writeFile(
    ".impeccable/review/layout-results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      errors,
      readingWidth: { open: readingOpen, collapsed: readingClosed },
      variants: results.map(
        ({ label, theme, viewport, violations, overflow }) => ({
          label,
          theme,
          viewport,
          violations: violations.map((v) => v.id),
          overflow,
        }),
      ),
    }),
  );
  if (errors.length || results.some((r) => r.violations.length || r.overflow))
    process.exitCode = 1;
} finally {
  await browser.close();
}
